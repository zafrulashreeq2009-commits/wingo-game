const express = require("express");
const router = express.Router();
const fs = require("fs");

function db(){
    return JSON.parse(fs.readFileSync("./db.json"));
}
function save(data){
    fs.writeFileSync("./db.json", JSON.stringify(data, null, 2));
}

// GET USER
router.get("/user/:id", (req,res)=>{
    let data = db();
    let user = data.users.find(u => u.id === req.params.id);
    res.json(user);
});

// BET SYSTEM
router.post("/bet", (req,res)=>{
    let data = db();
    let { id, amount, type } = req.body;

    let user = data.users.find(u => u.id === id);
    if(!user) return res.json({error:"no user"});

    amount = Number(amount);

    if(user.balance < amount){
        return res.json({error:"not enough"});
    }

    user.balance -= amount;

    const num = Math.floor(Math.random()*10);
    const result = num >= 5 ? "BIG" : "SMALL";

    if(type === result){
        user.balance += amount * 1.96;
    }

    save(data);

    res.json({result, number:num, balance:user.balance});
});

module.exports = router;
