# TDD

Test-Driven Development,测试驱动开发

简单来说,就是在有了需求之后,先写测试(Red),接着再去编写可以让测试通过的业务代码(Green),最后在所有测试保持通过的前提下整理设计(Refactor)

## 最简样例

假设我们现在需要通过C++来实现一个`Health`组件,要求挂载组件的角色受到伤害后，生命值下降，但不能低于 0

那么可以简单的转化成如下 Todo List

- [ ] 创建角色时，当前生命值等于初始化时传入的最大生命值
- [ ] 受到伤害后，生命值减少
- [ ] 生命值不能低于 0

然后我们先不写业务代码,而是一步一步来,先转化成下面的第一版最简测试 ——

```C++
#include <gtest/gtest.h>

TEST(HealthTest, StartsWithMaximumHealth) {
    Health health(100);

    EXPECT_EQ(health.GetCurrentHealth(), 100);
}
```

主要对应的是 Todo List 当中的第一条,然后现在运行绝对会报错,因为我们还没创建 Health 类(化简一下,直接用类),那么此时就是”Red“

接着开始写业务代码

```C++
class Health {
public:
    explicit Health(int maximum_health)
        : current_health_(maximum_health) {
    }

    int GetCurrentHealth() const {
        return current_health_;
    }

private:
    int current_health_;
};
```

好,现在运行 Test 肯定是可以 Pass 的,此处也没什么好重构的,于是继续构造新的测试

```C++
TEST(HealthTest, DamageReducesHealth) {
    Health health(100);

    health.TakeDamage(30);

    EXPECT_EQ(health.GetCurrentHealth(), 70);
}
```

注意,此时是为了针对 TakeDamage 方法写的测试,肯定爆,因为还没有`TakeDamage`方法,于是我们继续实现 ——

```C++
class Health {
public:
    explicit Health(int maximum_health)
        : current_health_(maximum_health) {
    }

    void TakeDamage(int damage) {
        current_health_ -= damage;
    }

    int GetCurrentHealth() const {
        return current_health_;
    }

private:
    int current_health_;
};
```

此时

```
[ PASSED ] HealthTest.StartsWithMaximumHealth
[ PASSED ] HealthTest.DamageReducesHealth
```

第三步同理,就这样逐步迭代下去,就是TDD的主要框架

## 一些好处

先说说好处 ——

- 需要在写测试的阶段就定义好接口,迫使我们较早思考接口的使用方式,同时也使得后续编写方便
- 在测试阶段就需要定义好输入输出和测试边界,强制我们不写模棱两可的东西(不过如果在测试的时候没有想到的边界大概率在实际编写业务逻辑的时候也不会发现就是)
- 在每次添加新的测试的时候一般都是小改动,可以减少负担
- 在重构或者添加新功能的时候,由于旧测试都还在,所以如果出错可以比较有方向性一些
- 测试都写好了,CI 友好(

## 一些疑惑

首先这感觉有点像是把需求先“代码化”的翻译一下?(~~来,大家,我们先把这个题目条件翻译成数学语言~~)那么这感觉只是换一种表达方式而已,所以如果我们对于测试的理解就是带有偏差的,那么依旧是写出带有偏差的代码,这在对于“正确性”上其实毫无价值 —— 我们相当于自己即是出卷人,也是答题者(

接着测试的“粒度”问题也很迷惑,对于初始化方法或者简单的暴露 Get / Set 接口之类的写测试固然是好的,但是真的有必要吗?为了沿着这个Red–Green–Refactor 的逻辑顺序.与此同时,由于每个步骤都需要可测试,可能会引入过多的接口,导致过度包装

以及比较”顺向“的思维方式是 —— 看需求,理解需求,设计我们需要的数据结构等,最后再写业务代码实现,然后 Debug 解决 Bug,迭代进行.那么测试先行的话,和这个逻辑链条不太一致.它可以保证我们每一个小步骤都是正确的,但是把大整体先拆解成那一个个小测试,是否能够保证全局的逻辑是正确的呢?而不是零散的各个小块

然后在日常开发中,也有很多不是可以简单的通过测试来固定的,比如 —— 运镜,UI交互,渲染结果之类的,那么此时我们要怎么拆解成独立的这种单元测试呢?

以及在未来如果需求改变了,那么我们要怎么对待旧测试,如何正确的拆解出和新的需求冲突的部分?

最后说点玄学的,Goodhart 定律告诉我们 ——

> 当一个指标变成目标时，它就不再是一个好指标

TDD可能存在一个风险 —— 它容易让测试成为目标，而不是真实需求的测量工具

没很懂,大概率是经验还不够丰富

## Vibe Coding

由于 Vibe Coding 的时候我们非常需要一个高效的方法来进行审查,以及判断其提供的到底是丑的还是香的.所以 TDD 确乎可以是一个不错的方法在其中 ——

一方面,拆解需求,这样每次循环只需要做最小修改,可以比较适合上下文窗口有限的情况(~~不对,好像我的上下文窗口还不如它们~~)

另一方面, PASS 可以很方便的成为它们判断是否可以继续下一步,或者在当前步骤继续迭代的指标.

而且也可以降低我们审核的心智负担 —— 一些边界情况等,就可以通过看测试通过来比较快速进行判断审核,而不需要慢慢的 Debug,审核重心或许就可以放在其他地方

诚然,这是一个好方法,但是我们依旧需要警惕 —— 一是上一个 Part 提到的,AI 自己对我们的需求理解产生偏差,然后再“自问自答”,得到带有偏差的答案

另一是比较现实的问题 —— 严格按照 TDD 走的话,输出测试,更多的编译Tool调用等,会烧钱包(

对的对的,这样不仅会使得 Tokens 消耗的更快,也会使得反复的测试占据上下文窗口

综上所述,这是一个不错的思路,但是可能还是要继续在实践和具体任务中寻找一个合理的边界(

