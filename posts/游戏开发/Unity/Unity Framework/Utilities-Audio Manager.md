# Audio Manager

音频管理器，管理背景音乐和fx音效

作为`service`，通过`Service Locator`管理

## 基本逻辑

创建`entry`数据，并且使用ScriptObject管理所有音频切片（`AudioCatalogSO`）
Audio Manager属于Service，对外提供
- `PlayBMG`
- `StopBMG`
- `SetBGMVolume`
- `PauseBGM`
- `ResumeBGM`
- `PlayFX`
- `SetMasterVolume`
- `SetBMGVolume`
- `SetFXVolume`
用于管理播放的所有音效
使用Handler允许注册回调函数（在PlaySFX的时候直接注册回调函数

## 使用方式

1. 创建音频`entry`的`SO`文件
2. 