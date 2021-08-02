# 项目笔记 - python

> 记录一些项目中 python 相关的问题

## 虚拟环境和包

> [Virtual Environments and Packages - Python Tutorial](https://docs.python.org/zh-cn/3/tutorial/venv.html)

### 创建虚拟环境

```shell
python3 -m venv tutorial-env
```

### 切换至虚拟环境

在 Windows 上，运行:

```shell
tutorial-env\Scripts\activate.bat
```

在 Unix 或 MacOS 上，运行:

```shell
source tutorial-env/bin/activate
```

### 生成一个类似的已安装包列表

```shell
pip freeze > requirements.txt
```

### 通过已安装包列表，安装所有依赖

```shell
python -m pip install -r requirements.txt
```
