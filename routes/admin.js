const express = require("express");
const router = express.Router();
const fs = require("fs");

function db(){
    return JSON.parse(fs.readFileSync("./db.json"));
}
function save(data){
    fs.writeFileSync("./db.json", JSON.stringify(data, null, 2));
}

// TOPUP USER BALANCE
router.post("/topup",(req,res)=>{
    let data = db();
    let { id, amount } = req.body;

    let user = data.users.find(u => u.id === id);
    if(!user) return res.json({error:"no user"});

    user.balance += Number(amount);
    save(data);

    res.json({success:true, balance:user.balance});
});

// ADD ADS
router.post("/ads",(req,res)=>{
    let data = db();
    data.ads.push(req.body);
    save(data);

    res.json({success:true});
});

module.exports = router;
