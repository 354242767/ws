
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