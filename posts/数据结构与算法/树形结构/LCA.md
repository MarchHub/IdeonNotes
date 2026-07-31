---
tags:
  - 数据结构与算法
  - 树与图
---

# LCA

最近公共祖先,LCA

值得注意，一个节点可以是自己的祖先,比如如果 `p` 本身就是 `q` 的祖先，那么 —— `LCA(p, q) = p`

先有一个朴素的解法 —— 从 root 开始遍历树,然后记录下 `root -> p` 和 `root -> q` 的两条路径,然后从root开始逐个比对路径,直到最后一个相同元素就是最近公共祖先了.

## 二叉树单次查询

先定函数签名的语义 —— 在以 `root` 为根的这棵子树里，寻找 `p` 和 `q` 的最近公共祖先。

`TreeNode* lowestCommonAncestor(TreeNode* root, TreeNode* p, TreeNode* q)`

那么对于返回值

- nullptr: 当前子树中没有找到 p 或者 q
- p 或 q: 当前子树中找到了 p 或 q 至少一个
- 祖先: 当前子树中找到了 p 和 q 的最近公共祖先

```C++
TreeNode* lowestCommonAncestor(TreeNode* root, TreeNode* p, TreeNode* q)
{

	if (root == nullptr)
		return nullptr;
	if (root == p || root == q)
		return root;

	TreeNode* left = lowestCommonAncestor(root->left, p, q);
	TreeNode* right = lowestCommonAncestor(root->right, p, q);

	if (left != nullptr && right != nullptr)
		return root;
	if (left != nullptr)
		return left;
	if (right != nullptr)
		return right;
	return nullptr;
}
```

本质上是一次后序遍历,先寻找左右子树是否含有 p 和 q, 然后再做判断 ——

- 如果左右子树返回的结果都不为空,说明分别含有p和q,于是当前root节点为LCA,否则当前root不可能为LCA
- 如果左边不为空,说明至少找到了左边有信息,向上返回;
	- 可能左侧子树的根节点就是LCA
	- 可能左侧只包含了 p 或者 q
- 如果右边不为空,说明至少找到了右子树中包含的信息,向上返回;
- 如果全都没有,返回空,说明没有任何有效信息

## 倍增

常用于多轮的LCA在线查询,其核心之一是通过预处理维护了`up[u][j]`数组,其中u表示节点u;j表示向上跳$2^j$层(深度),之后到达的祖先节点

在朴素算法里,我们是让两个节点一步一步往上找父节点,不错,但是在多轮查询的时候会有很大的时间开销 —— 容易想到,两个节点的LCA所在的深度一定是小于等于这两个节点的最小高度(就是在同一层或者在这两个节点头上)

### up 数组维护过程

实际上是基础的递推

1. `up[u][0] = parent[u]`
2. `up[u][j] = up[up[u][j - 1]][j - 1]`

看递推表达式 —— 内层的`up[u][j - 1]`表示先从u往上跳$2^{j-1}$,然后再以那个节点为跳板向上跳$2^{j-1}$,总共就是$2^j$次方,是我们想要的

### 查询流程

假设查询`LCA(u, v)`

假设已经预处理结束了,包括 depth 和 up 两个数组

1. 找到最深的节点,利用 up 数组迭代到 u, v 同一高度
2. 如果两个节点相同,直接返回(找到结果)
3. 两个节点一起从大到小利用 up 数组尝试向上跳。
   判断条件 `up[u][k] != up[v][k]`
   - 如果 `up[u][k] != up[v][k]`,说明 u 和 v 同时向上跳 $2^k$ 层后仍然没有汇合，因此它们还在 LCA 的下方，继续跳。
   - 如果 `up[u][k] == up[v][k]`,说明这一步跳完会汇合。这个汇合点可能是 LCA，也可能在 LCA 上方，所以不能跳，也不能直接返回，需要继续尝试更小的 k。
1. 循环结束后，u 和 v 还不是同一个节点，但是它们的父节点已经相同,因此返回 `up[u][0]`

## 写在最后

写着写着忽然想到了好几年前打OI时候的样子,这好吗?这不好 —— 以前在做死题(

~~BST 的 LCA 先埋个钩子~~

求LCA有什么用吗?

首先肯定要和树有关吧 —— 目录树 / 骨骼动画的骨骼绑定树 / world->level->GO->component 的庞大分层结构 等

举个例子 —— 在文件树的情景下,可以通过找LCA然后写相对路径?(不知道有没有用,反正蛮写,一些实践上的思考大抵也是比较重要的罢)