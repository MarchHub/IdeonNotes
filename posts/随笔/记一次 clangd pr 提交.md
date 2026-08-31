# 记一次 clangd pr 提交

很神奇的, 最近在重新在思考异常安全的时候忽然发现了在 vscode 中 `clangd` 进行 lambda 的 inlay hints 渲染时有一个小问题 —— 就是和草案规定的顺序不对应, 详细提交查看 [issue](https://github.com/clangd/clangd/issues/2696)

提出 issue 之后, 觉得自己膨胀了, 学了小半年 C++ 觉得自己很行, 而且原则上它的 AST 分析等都是对的, 所以不会涉及太底层的事情, 应该只要上游的 `clangd` 做一些小 patch 就好.

这个 inlay hints 主要是 `-> T` 的位置问题, 拿到一个大项目不可能盲目地大海捞针. `T` 是类型, 是变量, 而 `->` 是一定要被返回的, 所以直接进行一个

```bash
rg '"-> "' clang-tools-extra/clangd
```

返回结果 ——

```
clang-tools-extra/clangd/InlayHints.cpp
618: addTypeHint(Range, D->getReturnType(), /*Prefix=*/"-> "
);
```

这个命名也非常的符合我们的思路, 返回文本编辑器查看代码

```C++
void addReturnTypeHint(FunctionDecl *D, SourceRange Range) {
	auto *AT = D->getReturnType()->getContainedAutoType();
		if (!AT || AT->getDeducedType().isNull())
			return;
	addTypeHint(Range, D->getReturnType(), /*Prefix=*/"-> ");
}
```

直接看命名和函数签名就能想到 —— 对于返回值添加一个 Type Hint, 其中 `addTypeHint` 大概率就是把参数组织成 `Range -> Type` 的样子, 不过继续会看源码也可以得到证明

```C++
addInlayHint(R, HintSide::Right, InlayHintKind::Type, Prefix, TypeName, /*Suffix=*/"");
```

再稍微深入一层, `addInlayHint` 有两个重载, 一个是把 SourceRange 转化成 LSP 返回的位置再进行调用具体实现; 另一个是根据 `HintSide` 计算位置, 然后构造并保存 `InlayHint`; 所以可以直接看第二个重载 ——

```C++
Position LSPPos = Side == HintSide::Left ? LSPRange.start : LSPRange.end;
Results.push_back(InlayHint{LSPPos,
					/*label=*/{(Prefix + Label + Suffix).str()},
					Kind, PadLeft, PadRight, LSPRange});
```

`Result` 是收集结果的容器, 应该和当前的 patch 无关, 先不看, 后面发现重要的话再看, 重点先看 `InlayHint` 结构体的定义

```C++
/// The position of this hint.
Position position;
```

那么结合上述, 大体就可以证明我们的猜想 —— 「此处调用 `addTypeHint` 大概率就是把参数组织成 `Range -> Type` 的样子」

我们回到 `addReturnTypeHint` 这条思维链, 一共有

- `VisitLambdaExpr`
- `VisitFunctionDecl

这两个主要方法调用了它们, 那么 `Visit*` 的两个方法应该是同一族的操作. 不要犹豫, 直接看 `VisitLambdaExpr` 方法 —— 有几个原因

- `Function` 显然是对于普通函数相关的支持
- `LambdaExpr` 的提示还不明显吗 (

```C++
bool VisitLambdaExpr(LambdaExpr *E) {
	FunctionDecl *D = E->getCallOperator();
	if (!E->hasExplicitResultType()) {
		SourceLocation TypeHintLoc;
		if (!E->hasExplicitParameters())
			TypeHintLoc = E->getIntroducerRange().getEnd();
		else if (auto FTL = D->getFunctionTypeLoc())
			TypeHintLoc = FTL.getRParenLoc();
		if (TypeHintLoc.isValid())
			addReturnTypeHint(D, TypeHintLoc);
	}
	return true;
}
```

逻辑上, 有 `ReturnType` 的, 我们做一次判断, 然后给出 `TypeHintLoc`, 最后如果 `Hint` 合法就给它加上.

所以合理猜测我们需要修复的重点就是这个 `If` 分支.

第一条 `!E->hasExplicitParameters()` 表示对于没有明确写出参数列表的, 而我们显然是些了参数列表的情况(哪怕仅写了`()`也是空的参数列表, 会进入`else if` 分支, 不过在 C++23 之后允许在有修饰丢情况下仍可以不写参数列表, 所以大概率遇到这个情况也是错的, 不过由于当前 issue 还没针对这个问题进行说明所以先不管了, 后面再继续跟进) 所以合理查看 `else if` 语句 —— `getFunctionTypeLoc` 的注释写的非常清楚, 返回的是 `FunctionTypeLoc` 类型, 也就是一个除了一个函数的 Type 之外, 还有对应源码的位置信息等.

那么原先它要让我们插入的位置是 `RParentLoc()`, 也就是获得右侧圆括号的位置, 诶, 直击问题 —— 

```C++
auto f = []() -> void {}
```

这样原先应该是没问题的, 但是如果加入了 `noexcept` 之类的修饰就会出现瑕疵

```C++
auto f = []() -> void noexcept {} // 这样是语法错误, 只是渲染起来长这个样子而已
```

此处就不符合草案规定了, 所以我们大概装是找到修改位置了.

再重新查看下 `FLT` 还有提供什么成员方法可以让我们的位置标定在 `noexcept` 之后 —— 有的 `getLocalRangeEnd()` 就是返回当前语句的末尾, 所以最终我们的这个 issue 修复只有一行

```C++
TypeHintLoc = FTL.getRParenLoc();       //[!code --]
TypeHintLoc = FTL.getLocalRangeEnd();   //[!code ++]
```

上述是修复的心路历程, 论古法.