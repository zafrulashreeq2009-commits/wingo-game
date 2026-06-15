const express = require("express");
const router = express.Router();
const fs = require("fs");

function db(){
    return JSON.parse(fs.readFileSync("./db.json"));
}
function save(data){
    fs.writeFileSync("./db.json", JSON.stringify(data, null, 2));
}

// LOGIN (CREATE USER ID)
router.post("/login", (req,res)=>{
    let data = db();

    const user = {
        id: "USR" + Math.floor(Math.random()*999999),
        balance: 0
    };

    data.users.push(user);
    save(data);

    res.json(user);
});

module.exports = router;
