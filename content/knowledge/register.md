---
id: register
title: HKUST Registration, Student Account, Email and 2FA / 科大注册、账号、邮箱与双重验证
category: Registration
source: UST Buddy local knowledge base - HKUST registration and account setup guide
updatedAt: 2026-05-27
keywords:
  - registration
  - program registration
  - course registration
  - online registration
  - application number
  - student ID
  - HKUST account
  - ITSO
  - ITSC
  - student email
  - connect.ust.hk
  - email alias
  - 2FA
  - MFA
  - Duo
  - Microsoft Authenticator
  - HKUST card
  - landing slip
  - visa
  - Exit-Entry Permit
  - registration deadline
  - Add/Drop Period
  - 注册
  - 项目注册
  - 课程注册
  - 选课
  - 科大账号
  - 学生证号
  - 申请编号
  - 学生邮箱
  - 科大邮箱
  - 邮箱别名
  - 双重验证
  - 多重验证
  - 科大卡
  - 港澳通行证
  - 逗留签注
  - 小白条
  - 入境标签
  - 注册截止
---

## 基础概念

| 术语 | 英文 | 说明 |
| --- | --- | --- |
| 项目注册 | Program Registration | 线上填写教务处发出的 Online Registration Form |
| 选课 | Course Registration | 在 Student Center（往年称 SIS）进行 |
| 申请编号 | Application Number | 11 位数字（如 62500000000），注册前有用，注册后无用 |
| 学生证号 | Student ID / Student Number | 8 位数字，印在科大卡上，报名活动常用 |
| 科大账号 | HKUST Account / User Account | 科大统一账号（原 IT-SC 账号），可登录各科大系统 |
| 学生邮箱 | — | 账号 @connect.ust.hk，终身有效（毕业后自动转为校友邮箱） |

### 科大账号格式

`首字母缩写 + 姓氏全拼 + 序号`

- 第一部分：first name 的首字母（如 Chen Dawen → d）
- 第二部分：last name 全部字母（如 chen）
- 第三部分：序号（null, aa, ab, ..., az, ba, ...）

**示例：** 陈大文（Chen Dawen）→ `dchenaa@connect.ust.hk`

> 注意：绝大多数内地同学的 first name 连在一起写，因此首字母通常只有一个。

### 部门变更

- **ITSC**（Information Technology Services Center，资讯科技服务中心）
- **ISO**（Information Systems Office，信息系统处）
- **2025 年 1 月起**：ITSC + ISO 重组为 **ITSO**（Information Technology Services Office）
- https://itso.hkust.edu.hk/services/general-it-services/user-account/gethelp

---

## 重要时间线

| 时间 | 事项 |
| --- | --- |
| 7 月中旬（UG）/ 7 月下旬（PG） | 收到注册邀请邮件 |
| 8 月 26 日 | 开始选课 |
| 9 月 1 日 ~ 13 日 | Add/Drop Period（可添加/删除课程） |
| **9 月 13 日前** | **必须完成注册**，否则无法选课 |

> 建议 **8 月中旬前** 完成注册。

---

## 注册流程

### 第一步：激活科大账号

收到注册邀请邮件后，首先激活学生账号：

- **激活链接**：`https://myaccount.ust.hk/ams/commonConsole/acctActivation`
- 填写个人资料即可
- 遇到问题？清除缓存、更换浏览器或重启电脑再试

### 第二步：填写在线注册表

1. 登录注册系统
2. 如实填写 Online Registration Form
3. 上传证件及签证文件：
   - 持中国内地户口：上传 **港澳通行证**（含背面逗留 D 签注）
   - 已持有香港身份证：上传香港身份证
4. 上传 **入境标签（Landing Slip，俗称"小白条"）**：
   - 持学生签证过关时才能拿到
   - 如果届时还未拿到，可稍后补传

### 第三步：上传科大卡照片

- **认真拍摄！** 程序会初步审核，不合格会直接显示不通过
- 即使程序没识别出来，现场领取科大卡时职员也会检查
- 不合格会被要求当场重拍

**照片要求（摘要）：**
- 头部比例适中（不能太大或太小）
- 不戴帽子、太阳镜
- 其他具体要求见邮件附件

### 第四步：（本科生）填写声明表

- **Assumption of Risk and Release Form**
- 内容：离开学校参与实习、交换、课外活动时，学校不承担额外责任
- **未成年本科生** 需监护人签字
- 研究生无需填写此表

### 完成注册

| 阶段 | 条件 | 可做什么 |
| --- | --- | --- |
| **初步注册** | 激活账号 + 填写注册表 + 上传通行证 | 可登录科大网站、可选课 |
| **正式注册** | 上传入境标签后 | 收到领取科大卡邀请 |

---

## 注册后事项

### 邮箱设置

- **网页版**：`o365.ust.hk`（建议添加到收藏夹）
- **客户端**：推荐使用 Outlook（科大提供正版 Office 套装）
- 参考itso网站,上面还有Office全家桶
- https://itso.hkust.edu.hk/services/general-it-services/communication-collaboration/email/connect/setup-client

**进阶功能：**
https://myaccount.ust.hk/psetup/connect/
- **Display Name**：邮箱显示名，可无限次修改（如设置为"姓名"）
- **Email Alias**：自定义邮箱地址，只能设置一次
  - 示例：`dchenaa@connect.ust.hk` → 可设置为 `jacky.chen@connect.ust.hk`
  - PG 学生必须包含姓的拼音

### 双重要素验证（2FA）

科大要求在登录重要系统时进行双重验证，有两种方式：

| 方式                  | APP           | 备注                          |
| ------------------- | ------------- | --------------------------- |
| Microsoft Entra MFA | Authenticator | 科大推荐                        |
| Duo                 | Duo           | 传统方式,**HPC 高性能计算集群只能使用此方式** |

**设置链接**：`https://itsc.hkust.edu.hk/cyber-security/2FA`

**注意事项：**
- 如果只有一部手机且需要更换：可在网页获取**一次性登录码**
- 联系邮箱：`cchelp@ust.hk`

### 科大资源

完成后可使用：
- 各类正版软件
- VPN
- HPC 高性能计算集群
- 图书馆预定房间等

---

## 注意事项

1. 重置邮箱密码失败/网页一直报错,**不要回退网页**，不要中途退出——网页有信息就顺手记录下来
2. 准备好 **学生证号** 和 **科大账号**，确保网络稳定，一次性填完
3. 遇到问题：联系 **ITSO** → `cchelp@ust.hk`
4. 科大账号**无法修改**，即使包含不喜欢的含义也只能接受
5. 如果同一项目同学都收到邮件而你没收到，请联系项目组
6. 注册 ≠ 项目迎新 ≠ 宿舍 ≠ ELPA，每件事找各自负责部门即可

---

## 邮件联系模板

如需联系项目组或学校部门，建议包含：
- 姓名
- 学生证号（Student ID）
- 科大账号
- 具体问题描述
