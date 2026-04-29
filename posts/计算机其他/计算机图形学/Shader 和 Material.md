# Shader 和 Material

## Shader

着色器，说了和没说一样，从名字上大体能看出它的作用——告诉机器如何给图形着色，但是实际上到底是什么确是一点没提及（

理解为一种执行逻辑和参数布局

## Material

作为 Shader 的参数实例，定义了 Shader 中需要的各种参数，在 runtime 的时候喂给 Shader 使得其在对应的 Shade Stage 可以拥有一个完整的表达。

## 总结

Shader 相当于一个类，通过 Material 实例化，最后投喂给渲染管线来交付执行

按照以上理解，比如一个 Vertex Shader，对应 Graphics Pipeline 在 Vertex Shade Stage 的时候使用，所以一个 Material 应该就是这样一个 Vertex Shader 的实例。

但是现在一般来说会拓展一下，把一组对应不同Stage的Shader合并在一起称之为一个Shader，然后再对其提供具体参数写Material——这样其实就像是定义了整个 Pipeline 在 VS / FS / CS 等阶段的行为，而不是狭义的单独一个 Stage
