var app = require('express')();
const http = require('http').createServer(app, (req, res) => {
     res.setHeader('Access-Control-Allow-Origin', '*');
});

const io = require('socket.io')(http);
const uuid = require('uuid/v4');
var cors = require("cors");
const PORT = process.env.PORT || 5000
let users = {};
let publicMessages = [];
let privateMessages = [];

//input - logged in user (sender), push obj to arr only if this obj's name same;
//[{message, receiver, isPublic, user, id, time}, {......}] -> {[user.name]: [{message, receiver, isPublic, user, id, time}]}
   //returns object of all users with their corresponding arrays of values
app.use(cors())
const allMessages = (user) => {      
    return privateMessages.reduce((acc, obj) => { 
        if(obj.user.name === user.name){
            acc[user.name] = (acc[user.name] || []).concat(obj); 
        }                          
        return acc;            
    }, {});        
}

//{[user.name]: [{message, receiver, isPublic, user, id, time}]} -> return only one user's info (sender now)
const userMessages = (allUsersMessages, userName) => {
   return allUsersMessages[userName];

}

io.on('connection', (socket) => {
    console.log(socket.id);
    socket.on('NAME', (name, cb) => {
        if(name in users){
            cb({error: 'username is taken', user: null});
        }
        else {
            cb({error: '', user: {name, id: uuid(), socketID: socket.id}});
        }
    });
    socket.on('USER_TO_USERS', (user) => {
        const allUsers = Object.assign({}, users);
        allUsers[user.name] = user;
        users = allUsers;
        //console.log(users);
        io.emit('USERS', users);
    });
    //check if login user's name is in registered users list
    socket.on('CHECKUSER', (name, cb) => {
        console.log(`all users in server: ${JSON.stringify(users)}`);
        const matchedUsers = Object.values(users).filter((u) => {
            return u.name === name });  
        if(matchedUsers.length === 1){
            cb(matchedUsers[0]);
            console.log(JSON.stringify(matchedUsers));
        }
        else {
            cb(null);
        }
       
    });
    socket.on('MESSAGE', (message, user, isPublic, receiver) => {
        const messageObj = {
             message, receiver, isPublic, user, id: uuid(), time: getTime(new Date(Date.now()))
        }; 
        isPublic ? publicMessages.push(messageObj) : privateMessages.push(messageObj);
        
        //get object, where keys are sender's name and values are array of messages of this sender to private receivers
        const allUsersMessages = allMessages(user);  
        //console.log(allUsersMessages);      
       
        //get array of messages of this sender to private receivers
        const thisUserMessages = userMessages(allUsersMessages, user.name);         
        console.log(thisUserMessages, isPublic, receiver);

        //send to client (sender and receiver) array of messages of this user if private (!isPublic) 
        //and to all clients (sender and allreceivers) if public
        //last argument in 'MESSAGE' event is popup, if true, the popup will appear when messages displayed

        // eslint-disable-next-line no-unused-expressions
        isPublic ? io.emit('MESSAGE', publicMessages, isPublic, null, null, false) :
                 (socket.broadcast.to(receiver.socketID).emit('MESSAGE', thisUserMessages, isPublic, user, receiver, true), socket.emit('MESSAGE', thisUserMessages, isPublic, receiver, receiver, false))    
    });
    socket.on('TYPING', (isTyping, isPublic, user, receiver) => {
        if(isTyping && isPublic){          
             socket.broadcast.emit('TYPING', isTyping, user);   
        }          
        else if(isTyping && !isPublic){
            socket.broadcast.to(receiver.socketID).emit('TYPING', isTyping, user);           
        } 
        else if(!isTyping) {
            io.emit('TYPING', false, null);  
        }
    });       
});

const getTime = (date)=>{
    return `${date.getHours()}:${("0"+date.getMinutes()).slice(-2)}`; }

http.listen(PORT, () => console.log(`server is running on port ${PORT}`));