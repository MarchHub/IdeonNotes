# Work Stealing

当前的实现是, 优先执行自己队列中的任务, 如果空闲的话, 先尝试从全局的 InjectionQueue 中尝试接单, 如果还是空闲, 则尝试从其他 Worker 的队列中领任务. 如果还是空, 则进入休眠,交出资源,等待唤醒.

## 朴素设计

最简单的 —— 所有 Worker 共用一个队列, 然后让所有 Worker 抢占一个任务队列 (意义不明)

或者稍微好点, 所有 Worker 自己都有一个 LocalQueue 存储任务, 但是这样可能会导致任务分布不均 —— 比如一个 Job 可以产生多个任务的时候. 那么假设策略是插入本地队列进行执行, 就有可能导致本地队列任务繁重, 但是其他 Worker 闲的发慌.

所以借助 Work Stealing 的机制的目的是当多核可以负载比较均衡.

## 设计原理

Worker 对于自己的 LocalQueue 的操作是 —— 不管是 Push (自己产生新的任务) 还是 Pop (取出任务执行) 都是从一端 ( Back ) 来进行操作; 而外部 Steal 则是从另一端 ( Front ) 进行取走任务.

### Back

先看 Back 端的操作. 我们希望新发起的任务尽快完成, 所以把“任务发起的任务”放在同一端, 这样在当前任务执行完之后可以最快的进入子任务的执行 —— 这样有比较好的 cache locality, 因为触发的子任务可能会利用到父任务的部分状态.

### Front

那么之所以让 Steal 从另一端进行拿取任务, 一方面是为了减少双方去争夺同一个逻辑位置(由于现在不是无锁设计, 依旧使用同一个 mutex 来进行保护, 所以实际上从效率来说没什么差), 另一方面是当 Oldest 任务被取走之后, 那么 Oldest 所展开的子任务树也可能会被窃取, 提高并行化速度.

## Victim

在搜索到底要从拿个 Worker 中取任务的时候, 使用了确定的策略进行选取 —— 从当前 worker 的下一个 worker + `stealSeed` 开始选取, 如果是外部的则从 `stealSeed` 开始选取, 不过此处的 `seed` 是固定的. 这样的优点是比较简单方便. 但是缺点也非常明显, 就是对于每一个 Worker 它空闲之后 Steal 的策略是固定的, 然后在 Worker 数量比较多的时候, 这种全量的遍历搜索也比较贵.

## 总结

请 G 老师绘了一张ASCII流程图

```
				 Schedule()
					 │
		  ┌──────────┴──────────┐
		  │                     │
	 MainThread Job        AnyWorker Job
		  │                     │
		  ▼                     ▼
  MainThreadQueue        Who schedules?
								│
				   ┌────────────┴────────────┐
				   │                         │
			   Worker                    External
				   │                         │
				   ▼                         ▼
			 LocalQueue              InjectionQueue
				   │                         │
				   │                         │
				   └─────────┬───────────────┘
							 │
							 ▼
					   TryTakeJob()
							 │
			 ┌───────────────┼────────────────┐
			 │               │                │
		  Local           Injection         Steal
			 │               │                │
			 └───────────────┴────────────────┘
							 │
							 ▼
						  Execute
							 │
							 ▼
					  Queued → Running
```

差不多比较清晰. 稍作补充, `Main Thread` 是通过 `PumpMainThreadJobs` 来进行消费的