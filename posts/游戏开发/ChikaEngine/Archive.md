# Archive

姑且称之为 Archive Mode —— 它合并了 Read 和 Write 两种方法,是的读写非常的对称,大大减少出错概率.

## 简述

首先它是对读写的数据流的一种封装——假设我们需要把数据写成 binary、yaml 或者 json等,简单的做法就是定义一个IReadandWrite接口,然后分别把它们实现,最后在上层通过 Read 和 Write 两个方法对数据进行读写操作.

这很不错,只是有略微有点麻烦 —— 
```C#
public interface IWriteAndWrite {}
public class JsonStroge : IWriteAndWrite
{
	// 实现了 read 和 write
}
public class Scene
{
	public void SaveScene
	{
		var data = Serialize(SceneData);
		JsonStroge.Write(date)
	}
	public void ReadScene
	{
		var data = JsonStroge.Read(path);
		SceneData = data;
	}
}
```
 乍一看没什么问题,逻辑很不错,不过我们一定要保证 Read 和 Write 的读写顺序保持一致,这个东西才可以正常运行——因为假设我们实现了 Binary 的读写,它不是基于key-value的机制,所以一定要按照指针的偏移一步一步的往下走.假设此时读写顺序不一致,那么整个结构就会乱掉.

所以提出了 Archive 机制 —— 保证了读写的高度一致性,来极大的减少 bug 的出现.并且上层不需要关心读写,之需要执行一个 Transfer 即可 —— 也就是关心“我要存什么”(数据),而不是“我要怎么存”(操作).上层就再也不需要显示的调用 Write 或者 Read 方法,比较简洁.

这样整个逻辑就从 “ 命令式 ” 转移到了 “ 声明式 ”

下面来个最简的 Archive 逻辑
```C++
enum class ArchiveMode { Read, Write };
class IArchive
{
  public:
	virtual void Transfer(const char* name, int& value) = 0;
	virtual void Transfer(const char* name, float& value) = 0;
}
class JsonArchiveReder : public IArchive
{
	// 实现了 int float 等的从磁盘读取
}
class JsonArchiveWriter : public IArchive
{
	// 实现了 各种类型 的从读盘读取
}

class Serializer
{
  public:
    static void Serialize(IArchive& ar, void* instance, const Reflection::ClassInfo& info)
    {
      // 根据类型分发
		if (field.typeName == "int")
		    ar.Transfer(fieldName, *static_cast<int*>(fieldPtr));
		else if (field.typeName == "float") 
		    ar.Transfer(fieldName, *static_cast<float*>(fieldPtr));
    }
}
class Scene
{
  public:
    void SaveScene()
    {
        JsonArchiveWriter writer;
        const auto* goInfo =  Reflection::TypeRegister::Instance().GetClass("GameObject");
        // 之需要序列化进去就行,因为底层调用的是 Json
	    Serializer::Serialize(writer, go, *goInfo);
    }
    
    void RestoreScene()
    {
	    JsonArchiveReader reader();
	    Serilizer::Serialize(reader, go, *goInfo);
    }
}
```
接着如果想要使用二进制读写,之需要把 JsonArchiveReader 和 JsonArchiveWriter 分别替换成 BinaryArchiveReader 和 BinaryArchiveWriter 就好,上层逻辑不用变化,只需要正确实现 Binary 的读写就好.

这样,把读写操作下沉到`IArchive`中,而业务层只需要关心数据即可,显得更整洁.

当然,上述只是描述一个数据流的过程,如果在生产实践中,我们还需要引入一个磁盘读写层给上层调用来实现持久化.
## cereal 分析

最后贴下 [Unreal Archive](https://github.com/EpicGames/UnrealEngine/blob/release/Engine/Source/Runtime/Core/Public/Serialization/Archive.h) 以供学习

