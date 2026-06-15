let currentUser = null;

async function login() {
    const res = await fetch("/api/login", {
        method: "POST"
    });
    currentUser = await res.json();

    alert("ID anda: " + currentUser.id);
    loadUser();
}

async function loadUser() {
    const res = await fetch("/api/user/" + currentUser.id);
    const data = await res.json();

    document.getElementById("balance").innerText =
        "RM " + data.balance.toFixed(2);
}
