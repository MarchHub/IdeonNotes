---
tags:
  - 数据结构与算法
  - 字符串算法
---

# LeetCode 214

> 给定一个字符串 _**s**_，你可以通过在字符串前面添加字符将其转换为回文串。找到并返回可以用这种方式转换的最短回文串。
>
> **示例 1：**
> **输入：** s = "aacecaaa"
> **输出：** "aaacecaaa"
> 
> **示例 2：**
> **输入：** s = "abcd"
> **输出：** "dcbabcd"
> 
> **提示：**
> - `0 <= s.length <= 5 * 104`
> - `s` 仅由小写英文字母组成

看到回文串第一反应是马拉车或者`dp`。

但是认真思考样例 ——

在示例一中，我们添加的前缀是"a"，恰好是"aacecaa"这个最长回文前缀去掉之后的部分再进行一个反转。
示例二同理

仔细一想确乎是这样 ——

- 把整个原串反转后拼接，一定是回文串
- 如果前缀是回文的，那么不需要考虑

所以把原问题转化成“找 s 的最长回文前缀”

那么这又想到马拉车了 —— 跑马拉车的时候**维护一下可以触碰到最左侧的回文串的长度，找到最长的即可**

于是可以有第一种解法。

但是又看到了找”前缀“这件事情，所以不妨看看KMP能不能解 ——

先明确KMP维护的`pi[i]`表示`P[0...i]`中最长的相同的前后缀，所以就要寻找最长回文前缀的问题化归成最长相同前后缀问题 ——

“把回文串沿着中心劈开，把前一半反转一下就和后一半一致”

想到构造 ——

```
combine = s + "#" + reverse(s)
```

直接看例子

```
a a c e c a a a # a a a c e c a a
^-----------^                       前缀来自 s

                    ^-------------^ 后缀来自 reverse(s)
```

`a a c e c a a` 就是我们需要找的最长回文前缀，同时也是KMP可以找到的相同前后缀

问题结束，给出核心代码片段

```C++
string shortestPalindrome(string s)
{
	string rev = s;
	std::reverse(rev.begin(), rev.end());
	string t = s + "$" + rev;
	
	vector<int> pi = buildPi(t);
	
	int longestPrefixLen = pi.back();
	string rest = s.substr(longestPrefixLen);
	std::reverse(rest.begin(), rest.end());
	
	return rest + s;
}
```
