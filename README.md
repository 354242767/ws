---
title: node和socket.io实现简易聊天室
date: 2018-05-24 11:10:08
categories:
 前端
tags:
 node
 socket.io
 mysql
 聊天室
description: 
 利用node和socket.io及mysql实现简易聊天室
---

# 项目技术栈
`node`+`socket.io`+`mysql`

# 数据库准备
创建一个user_table 的表格 包括字段有：ID、username、password、online（0/1 表示在线或离线）

项目目录：
```
|---ws
|   |---node_modules
|   |---server.js
|   |---index.html
|   |---package.json

```

`server.js`
```

const http=require('http');
const fs=require('fs');
const url=require('url');
const io=require('socket.io')(http);
const mysql=require('mysql');

//连接池
//单一连接 mysql.createConnection({});

let db=mysql.createPool({
    host     : 'localhost',       
    user     : 'root',              
    password : '123456',       
    port: '3306',                   
    database: 'test', 
});

//创建http服务器
let httpServer=http.createServer((req,res)=>{
    
});
httpServer.listen(8080);
console.log('you are listening ports 8080');

//2.创建websocket服务(监听http服务)
let wsServer=io.listen(httpServer);

let aSock=[];
wsServer.on('connection',function(sock){
    aSock.push(sock);

    let cur_username='';
    let cur_userID=0;

    //注册
    sock.on('reg',(user,pass)=>{
        //1.校验数据
        if(!/^\w{6,32}$/.test(user)){
            sock.emit('reg_ret',1,'用户名不符合规范');
        }else if(!/^\w{6,32}$/.test(pass)){
            sock.emit('reg_ret',1,'密码不符合规范');
        }else{
             //2.用户是否存在
            db.query('select ID from user_table where username=?',[user],(err,data)=>{
                if(err){
                    sock.emit('reg_ret',1,'数据库有误1');
                }else if(data.length>0){
                    sock.emit('reg_ret',1,'用户已存在');
                }else{
                     //3.插入
                    db.query('insert into user_table (username,password,online) values(?,?,0)',[user,pass],err=>{
                        if(err){
                            sock.emit('reg_ret',1,'数据库有误2'); 
                        }else{
                            sock.emit('reg_ret',0,'注册成功'); 
                        }
                    });
                }
            });
            
        } 
    })

    //登录
    sock.on('login',(user,pass)=>{
        if(!/^\w{6,32}$/.test(user)){
            sock.emit('login_ret',1,'用户名不符合规范');
        }else if(!/^\w{6,32}$/.test(pass)){
            sock.emit('reg_ret',1,'密码不符合规范');
        }else{
            db.query('select ID,password from user_table where username=? ',[user],(err,data)=>{
                if(err){
                    sock.emit('login_ret',1,'数据库有误3'); 
                }else if(data.length==0){
                    sock.emit('login_ret',1,'用户不存在'); 
                }else if(data[0].password!=pass){
                    sock.emit('login_ret',1,'用户名或密码错误'); 
                }else{
                    db.query('update user_table set online=1 where ID=?',[data[0].ID],()=>{
                        if(err){
                            sock.emit('login_ret',1,'数据库有误4'); 
                        }else{
                            cur_username=user;
                            cur_userID=data[0].ID;
                            sock.emit('login_ret',0,'登录成功'); 
                        }
                    });
                   
                }
            });
        }
    })

    //发言
    sock.on('msg',txt=>{
        if(!txt){
            sock.emit('msg_ret',1,'消息不能为空');
        }else{
            //广播给所有人
            aSock.forEach(item=>{
                if(item==sock) return;
                item.emit('msg',cur_username,txt);
            })
            
            sock.emit('msg_ret',0,'发送成功');
        }
    })

    // 离线
    sock.on('disconnect',()=>{
        db.query('update user_table set online=0 where ID=?',[cur_userID],err=>{
            if(err){
                console.log('数据库有误4')
            }
            cur_username='';
            cur_userID=0;
            aSock=aSock.filter(item=>item!=sock);
        });
    })
})
```

`index.html`
``` html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>1.html</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <script src="http://localhost:8080/socket.io/socket.io.js"></script>
    <style>
        .mine{
            color:green;
        }
    </style>
</head>
<body>
   名 字：<input type="text" id="user"/><br>
   密 码：<input type="password" id="pass"><br>
   <input type="button" value="注册" id="btn1"> <input type="button" value="登录" id="btn2">
   <hr>
    <textarea name="" id="txt1" cols="80" rows="10"></textarea>
    <input type="button" value="发送" id="btn_send">
    <ul id="ul1">
        <!-- <li>
            <h3></h3>
            <p></p>
        </li> -->
    </ul>
    <script>
        let sock=io.connect('ws://localhost:8080/');

        window.onload=function(){
            let cur_username='';

            let oBtn1=document.getElementById('btn1');
            let oBtn2=document.getElementById('btn2');
            let oBtnSend=document.getElementById('btn_send');
            let oUser=document.getElementById('user');
            let oPass=document.getElementById('pass');
            let oTxt=document.getElementById('txt1');
            let oUl=document.getElementById('ul1');

            //注册
            oBtn1.onclick=function(){
                sock.emit('reg',oUser.value,oPass.value);
            }
            sock.on('reg_ret',(code,msg)=>{
                if(code){
                    alert(msg);
                }else{
                    alert(msg);
                }
            })

            // 登录
            oBtn2.onclick=function(){
                sock.emit('login',oUser.value,oPass.value);
            }
            sock.on('login_ret',(code,msg)=>{
                if(code){
                    alert(msg);
                }else{
                    // 成功
                    cur_username=oUser.value
                    alert(msg);
                }
            })

            // 发言
            oBtnSend.onclick=function(){
                sock.emit('msg',oTxt.value);
            }

            //接收别人的消息
            sock.on('msg',(name,txt)=>{
                let oli=document.createElement('li');
                oli.innerHTML='<h3>'+name+'</h3><p>'+txt+'</p>';
                oUl.appendChild(oli);
            })
            //接收自己的消息
            sock.on('msg_ret',(code,msg)=>{
                if(code){
                    alert('发送失败：'+msg);
                }else{
                    // alert('发送成功：'+msg);
                    let oli=document.createElement('li');
                    oli.className='mine'

                    oli.innerHTML='<h3>'+cur_username+'</h3><p>'+oTxt.value+'</p>';

                    oUl.appendChild(oli);
                    oTxt.value='';
                }
            })
        }

       
    </script>
</body>
</html>
```
至此，浏览器地址输入文件地址 file:///D:/vsCode/ws/index.html 打开两个浏览器即可实现简易聊天室

[传送门：https://github.com/354242767/ws](https://github.com/354242767/ws)