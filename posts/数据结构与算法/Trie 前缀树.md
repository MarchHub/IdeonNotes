# Trie 前缀树

简单来说,在存储大量字符串时, 往往会出现大量公共 prefix, 那么 Trie 将这些公共 prefix 对应的状态共享,通过字符作为状态转移条件,这样从 root 沿路径游走即可表示一个字符串

## 基础例子

```C++
                    root
                  /      \
                 a        b
                 |        |
                 p        a
               /   \      |
              p*    t*    n
              |           |
              l           a
             / \          |
            e*  y*        n
                          |
                          a*
```

假设有这样一颗树,其中 * 表示这是遍历到这里是一个字符串的结束,那么我们做深度优先遍历的时候就可以简单得到 ——

- app
- apple
- apply
- apt
- banana

这些是我们存储的数据

不过或许把字符给理解成状态转移的条件会更好 —— 比如当前状态是 "ap" 然后借助此时的输入 "p" 转移到下一个状态 "app", 所以每一个 node 实际上是状态,然后其本质也可以理解成一个前缀状态机(

## Flat Vector

此处提供一个开`vector<Node>`类型的数组,把一整颗树在物理上压平成一个连续内存数据结构来进行存储的实现方式.

比较“传统”的实现方式那肯定是每个 Node 都存 26 个指针,每个指针指向自己的孩子,那么此处可以理解为把指针替换成一个唯一下标,指向 vector 中对应孩子存储的 index

```C++
using NodeID = std::size_t;

static constexpr NodeID INVALID =
    std::numeric_limits<NodeID>::max();

struct Node
{
    std::array<NodeID, 26> children;
    bool is_end = false;

    Node()
    {
        children.fill(INVALID);
    }
};
```

每一个 Node 的 children 最多有二十六个(在我们仅仅存储所有小写英文字母的情况下), array 做的事情是记录对于一个input character 来说,我们如何映射到孩子 Node 在 Vector 中存储的位置

这样使用 vector 存储比较直观的好处在于 —— 

- 更好的内存局部性
- 序列化 / 反序列化方便
- 减少独立 allocation (对于每次创建新的节点都 new 或者 make_unique 之类的)

对于children的存储结构选择,也可以使用哈希表来实现 —— 当字符集大或 Trie 极度稀疏的时候,这样可以规避每个孩子都开辟 26 个 size_t 的占用 (当然使用其他高级的 / 优化过的 Trie 也不是不行) —— 不过代价是 hash、bucket、额外间接访问以及通常更差的 locality

提供一下简单的模板

不提供模板了