/* =====================================================
   POINTS PLAZA
   Frontend Demo JavaScript
   ===================================================== */

const MASTER_ADMIN = "azeemolajuwon25@gmail.com";

let state = JSON.parse(localStorage.getItem("pointsPlaza")) || {

    currentUser: null,

    users: [],

    tasks: [
        {
            id: 1,
            name: "Follow Our Instagram",
            description: "Visit our Instagram page and follow the official account.",
            reward: 100,
            link: "#",
            status: "active"
        },
        {
            id: 2,
            name: "Join Telegram",
            description: "Join the official Points Plaza Telegram community.",
            reward: 150,
            link: "#",
            status: "active"
        },
        {
            id: 3,
            name: "Create Your Profile",
            description: "Complete your Points Plaza profile information.",
            reward: 75,
            link: "#",
            status: "active"
        }
    ],

    submissions: [],

    withdrawals: [],

    transactions: [],

    notifications: [],

    milestones: [
        {
            id: 1,
            referrals: 5,
            reward: 500
        },
        {
            id: 2,
            referrals: 10,
            reward: 1200
        },
        {
            id: 3,
            referrals: 25,
            reward: 3500
        }
    ],

    settings: {
        conversionRate: 100,
        referralReward: 100,
        minWithdrawal: 500,
        maxWithdrawal: 50000,
        communityWhatsApp: "#",
        communityTelegram: "#"
    }
};


/* =====================================================
   INITIALIZATION
   ===================================================== */

document.addEventListener("DOMContentLoaded", () => {

    saveState();

    document
        .getElementById("loginForm")
        .addEventListener("submit", login);

    document
        .getElementById("registerForm")
        .addEventListener("submit", register);

    if (state.currentUser) {
        openDashboard();
    }

});


function saveState() {

    localStorage.setItem(
        "pointsPlaza",
        JSON.stringify(state)
    );

}


/* =====================================================
   AUTH
   ===================================================== */

function showAuth(type) {

    const login = document.getElementById("loginForm");
    const register = document.getElementById("registerForm");

    const tabs = document.querySelectorAll(".auth-tab");

    if (type === "login") {

        login.classList.remove("hidden");
        register.classList.add("hidden");

        tabs[0].classList.add("active");
        tabs[1].classList.remove("active");

    } else {

        login.classList.add("hidden");
        register.classList.remove("hidden");

        tabs[0].classList.remove("active");
        tabs[1].classList.add("active");

    }

}


function register(e) {

    e.preventDefault();

    const username =
        document.getElementById("registerUsername").value.trim();

    const name =
        document.getElementById("registerName").value.trim();

    const email =
        document.getElementById("registerEmail").value.trim().toLowerCase();

    const password =
        document.getElementById("registerPassword").value;

    const confirm =
        document.getElementById("registerConfirm").value;


    if (password !== confirm) {

        toast("Passwords do not match.");

        return;
    }


    if (password.length < 6) {

        toast("Password must contain at least 6 characters.");

        return;
    }


    const exists = state.users.find(
        user =>
            user.email === email ||
            user.username.toLowerCase() === username.toLowerCase()
    );


    if (exists) {

        toast("Username or email already exists.");

        return;
    }


    const user = {

        id: Date.now(),

        username,

        name,

        email,

        password,

        taskBalance: 0,

        referralBalance: 0,

        referrals: [],

        claimedMilestones: [],

        completedTasks: [],

        bank: {},

        transactions: [],

        registeredAt: new Date().toISOString(),

        banned: false,

        isAdmin: email === MASTER_ADMIN

    };


    state.users.push(user);

    state.currentUser = user.id;

    state.notifications.push({

        userId: user.id,

        text: "Welcome to Points Plaza! 🎉",

        date: new Date().toISOString()

    });


    saveState();

    toast("Account created successfully!");

    setTimeout(openDashboard, 600);

}


function login(e) {

    e.preventDefault();

    const identity =
        document.getElementById("loginIdentity").value
            .trim()
            .toLowerCase();

    const password =
        document.getElementById("loginPassword").value;


    const user = state.users.find(

        u =>
            (
                u.email.toLowerCase() === identity ||
                u.username.toLowerCase() === identity
            )
            &&
            u.password === password

    );


    if (!user) {

        toast("Invalid login details.");

        return;
    }


    if (user.banned) {

        toast("Your account has been banned.");

        return;
    }


    state.currentUser = user.id;

    saveState();

    openDashboard();

}


function logout() {

    state.currentUser = null;

    saveState();

    document.getElementById("app").classList.add("hidden");

    document.getElementById("authScreen").classList.remove("hidden");

    showAuth("login");

}


function forgotPassword() {

    toast("Password reset will be connected to your email service.");

}


/* =====================================================
   DASHBOARD
   ===================================================== */

function getUser() {

    return state.users.find(
        u => u.id === state.currentUser
    );

}


function openDashboard() {

    const user = getUser();

    if (!user) return;


    document
        .getElementById("authScreen")
        .classList.add("hidden");

    document
        .getElementById("app")
        .classList.remove("hidden");


    document.getElementById("topUsername").textContent =
        user.username;

    document.getElementById("welcomeUsername").textContent =
        user.username;


    document.getElementById("userAvatar").textContent =
        user.username.charAt(0).toUpperCase();

    document.getElementById("profileAvatar").textContent =
        user.username.charAt(0).toUpperCase();


    if (user.isAdmin || user.email === MASTER_ADMIN) {

        document
            .getElementById("adminNav")
            .classList.remove("hidden");

    }


    renderAll();

    showPage("home");

    openCommunity();

}


function renderAll() {

    renderBalances();

    renderTasks();

    renderTeam();

    renderMilestones();

    renderWithdrawalHistory();

    renderProfile();

    renderEarnings();

    renderAdmin();

    renderNotifications();

}


/* =====================================================
   NAVIGATION
   ===================================================== */

function showPage(page) {

    document
        .querySelectorAll(".page")
        .forEach(p => p.classList.remove("active-page"));


    const selected =
        document.getElementById(page + "Page");

    if (!selected) return;

    selected.classList.add("active-page");


    const titles = {

        home: ["Dashboard", "Manage your Points Plaza account"],

        tasks: ["Tasks", "Complete tasks and earn points"],

        team: ["Referral Team", "Grow your referral network"],

        withdrawal: ["Withdrawal", "Cash out your points"],

        profile: ["Profile", "Manage your account"],

        admin: ["Admin Dashboard", "Manage Points Plaza"]

    };


    document.getElementById("pageTitle").textContent =
        titles[page][0];

    document.getElementById("pageSubtitle").textContent =
        titles[page][1];


    document
        .querySelectorAll(".nav-item")
        .forEach(item => item.classList.remove("active"));


    document
        .querySelectorAll(".bottom-nav button")
        .forEach(item => item.classList.remove("active"));


    if (page !== "admin") {

        const buttons =
            document.querySelectorAll(".nav-item");

        buttons.forEach(button => {

            if (
                button.textContent
                    .toLowerCase()
                    .includes(page === "withdrawal"
                        ? "withdrawal"
                        : page)
            ) {
                button.classList.add("active");
            }

        });

    }

}


/* =====================================================
   BALANCES
   ===================================================== */

function renderBalances() {

    const user = getUser();

    if (!user) return;


    const main =
        user.taskBalance + user.referralBalance;


    document.getElementById("taskBalance").textContent =
        user.taskBalance.toLocaleString();

    document.getElementById("referralBalance").textContent =
        user.referralBalance.toLocaleString();

    document.getElementById("mainBalance").textContent =
        main.toLocaleString();


    const totalTasks =
        state.tasks.length;

    const completed =
        user.completedTasks.length;

    const percentage =
        totalTasks === 0
            ? 0
            : Math.round((completed / totalTasks) * 100);


    document.getElementById("taskProgressBar").style.width =
        percentage + "%";

    document.getElementById("taskProgressText").textContent =
        percentage + "%";

    document.getElementById("completedTasks").textContent =
        completed + " completed";

    document.getElementById("totalTasks").textContent =
        totalTasks + " tasks";

}


/* =====================================================
   TASKS
   ===================================================== */

function renderTasks() {

    const user = getUser();

    const container =
        document.getElementById("tasksContainer");


    container.innerHTML = "";


    state.tasks.forEach(task => {

        const submission =
            state.submissions.find(

                s =>
                    s.userId === user.id &&
                    s.taskId === task.id &&
                    s.status === "pending"

            );


        const completed =
            user.completedTasks.includes(task.id);


        let status = "Available";

        if (completed)
            status = "Approved";

        else if (submission)
            status = "Pending";


        const button = completed

            ? `<button class="secondary-btn" disabled>
                    Task Completed
               </button>`

            : submission

            ? `<button class="secondary-btn" disabled>
                    Awaiting Approval
               </button>`

            : `<button class="primary-btn"
                    onclick="openProof(${task.id})">
                    Submit Proof
               </button>`;


        container.innerHTML += `

            <div class="task-card">

                <div class="task-top">

                    <div class="task-icon">
                        ✓
                    </div>

                    <div class="task-reward">
                        +${task.reward} PTS
                    </div>

                </div>

                <h3>${task.name}</h3>

                <p>${task.description}</p>

                <span class="status ${
                    status === "Approved"
                        ? "approved"
                        : status === "Pending"
                        ? "pending"
                        : "available"
                }">
                    ${status}
                </span>

                <br>

                <a
                    href="${task.link}"
                    target="_blank"
                    style="
                        display:inline-block;
                        margin-top:12px;
                        color:#2563eb;
                        font-size:12px;
                        font-weight:700;
                    "
                >
                    Open Task →
                </a>

                ${button}

            </div>
        `;

    });

}


function openProof(taskId) {

    const task =
        state.tasks.find(t => t.id === taskId);

    document.getElementById("proofTaskId").value =
        taskId;

    document.getElementById("proofTaskName").textContent =
        task.name;

    document.getElementById("proofText").value = "";

    document
        .getElementById("proofModal")
        .classList.remove("hidden");

}


function submitProof() {

    const user = getUser();

    const taskId =
        Number(document.getElementById("proofTaskId").value);

    const proof =
        document.getElementById("proofText").value.trim();


    if (!proof) {

        toast("Please enter your proof.");

        return;
    }


    const alreadySubmitted =
        state.submissions.find(

            s =>
                s.userId === user.id &&
                s.taskId === taskId &&
                s.status === "pending"

        );


    if (alreadySubmitted) {

        toast("You already have a pending submission.");

        return;
    }


    state.submissions.push({

        id: Date.now(),

        userId: user.id,

        taskId,

        proof,

        status: "pending",

        createdAt: new Date().toISOString()

    });


    state.notifications.push({

        userId: user.id,

        text: "Your task proof was submitted for review.",

        date: new Date().toISOString()

    });


    saveState();

    closeModal("proofModal");

    renderAll();

    toast("Proof submitted successfully.");

}


/* =====================================================
   TEAM / REFERRALS
   ===================================================== */

function renderTeam() {

    const user = getUser();

    const referrals =
        user.referrals || [];


    document.getElementById("referralCount").textContent =
        referrals.length;


    document.getElementById("teamEarnings").textContent =
        user.referralBalance.toLocaleString();


    document.getElementById("referralLink").value =
        window.location.origin +
        window.location.pathname +
        "?ref=" +
        user.username;


    const list =
        document.getElementById("referralList");


    if (referrals.length === 0) {

        list.innerHTML = `
            <div style="
                padding:25px 0;
                color:#718096;
                text-align:center;
                font-size:13px;
            ">
                No referrals yet.
            </div>
        `;

        return;
    }


    list.innerHTML = "";


    referrals.forEach(id => {

        const referral =
            state.users.find(u => u.id === id);

        if (!referral) return;


        list.innerHTML += `

            <div class="referral-list-item">

                <div>
                    <strong>${referral.username}</strong>
                    <small style="
                        display:block;
                        color:#718096;
                        margin-top:3px;
                    ">
                        ${referral.email}
                    </small>
                </div>

                <strong style="color:#16a34a">
                    Active
                </strong>

            </div>
        `;

    });

}


function copyReferral() {

    const input =
        document.getElementById("referralLink");

    navigator.clipboard.writeText(input.value);

    toast("Referral link copied!");

}


function shareReferral() {

    const link =
        document.getElementById("referralLink").value;


    if (navigator.share) {

        navigator.share({

            title: "Join Points Plaza",

            text: "Join Points Plaza and start earning points!",

            url: link

        });

    } else {

        copyReferral();

    }

}


/* =====================================================
   MILESTONES
   ===================================================== */

function renderMilestones() {

    const user = getUser();

    const container =
        document.getElementById("milestonesContainer");

    container.innerHTML = "";


    state.milestones.forEach(m => {

        const count =
            user.referrals.length;

        const claimed =
            user.claimedMilestones.includes(m.id);

        const unlocked =
            count >= m.referrals;


        container.innerHTML += `

            <div class="milestone">

                <div class="milestone-row">

                    <div>

                        <strong>
                            ${m.referrals} Referrals
                        </strong>

                        <small>
                            +${m.reward} PTS
                        </small>

                    </div>

                    ${
                        claimed

                        ? `<span class="claimed">
                                ✓ Claimed
                           </span>`

                        : unlocked

                        ? `<button
                                class="claim-btn"
                                onclick="claimMilestone(${m.id})"
                           >
                                Claim
                           </button>`

                        : `<small>
                                ${count}/${m.referrals}
                           </small>`
                    }

                </div>

            </div>
        `;

    });

}


function claimMilestone(id) {

    const user = getUser();

    const milestone =
        state.milestones.find(m => m.id === id);


    if (!milestone) return;


    if (user.referrals.length < milestone.referrals) {

        toast("Milestone not unlocked.");

        return;
    }


    if (user.claimedMilestones.includes(id)) {

        toast("Already claimed.");

        return;
    }


    user.claimedMilestones.push(id);

    user.referralBalance += milestone.reward;


    addTransaction(
        user.id,
        "milestone",
        milestone.reward,
        "Referral milestone reward"
    );


    saveState();

    renderAll();

    toast("Milestone reward claimed! 🎉");

}


/* =====================================================
   WITHDRAWAL
   ===================================================== */

function calculateWithdrawal() {

    const user = getUser();

    const wallet =
        document.getElementById("withdrawWallet").value;

    const amount =
        Number(
            document.getElementById("withdrawAmount").value
        ) || 0;


    const balance =
        wallet === "task"
            ? user.taskBalance
            : user.referralBalance;


    const naira =
        amount / state.settings.conversionRate;


    document.getElementById("withdrawNaira").textContent =
        naira.toFixed(2);

    document.getElementById("conversionRate").textContent =
        state.settings.conversionRate;


    if (amount > balance) {

        document.getElementById("withdrawNaira")
            .style.color = "#ef4444";

    } else {

        document.getElementById("withdrawNaira")
            .style.color = "#2563eb";

    }

}


function submitWithdrawal() {

    const user = getUser();


    const wallet =
        document.getElementById("withdrawWallet").value;

    const amount =
        Number(
            document.getElementById("withdrawAmount").value
        );


    const bankName =
        document.getElementById("bankName").value.trim();

    const accountName =
        document.getElementById("accountName").value.trim();

    const accountNumber =
        document.getElementById("accountNumber").value.trim();


    const balance =
        wallet === "task"
            ? user.taskBalance
            : user.referralBalance;


    if (!amount || amount <= 0) {

        toast("Enter a valid withdrawal amount.");

        return;
    }


    if (amount > balance) {

        toast("Insufficient balance.");

        return;
    }


    if (amount < state.settings.minWithdrawal) {

        toast(
            `Minimum withdrawal is ${state.settings.minWithdrawal} PTS.`
        );

        return;
    }


    if (amount > state.settings.maxWithdrawal) {

        toast(
            `Maximum withdrawal is ${state.settings.maxWithdrawal} PTS.`
        );

        return;
    }


    if (
        !bankName ||
        !accountName ||
        !accountNumber
    ) {

        toast("Please complete your bank details.");

        return;
    }


    state.withdrawals.push({

        id: Date.now(),

        userId: user.id,

        wallet,

        amount,

        naira:
            amount / state.settings.conversionRate,

        rate:
            state.settings.conversionRate,

        bankName,

        accountName,

        accountNumber,

        status: "pending",

        createdAt: new Date().toISOString()

    });


    user.bank = {

        bankName,

        accountName,

        accountNumber

    };


    state.notifications.push({

        userId: user.id,

        text: "Your withdrawal request has been submitted.",

        date: new Date().toISOString()

    });


    saveState();

    renderAll();

    toast("Withdrawal request submitted.");

}


function renderWithdrawalHistory() {

    const user = getUser();

    const container =
        document.getElementById("withdrawalHistory");


    const withdrawals =
        state.withdrawals.filter(
            w => w.userId === user.id
        );


    if (!withdrawals.length) {

        container.innerHTML = `
            <p style="
                color:#718096;
                font-size:13px;
            ">
                No withdrawals yet.
            </p>
        `;

        return;
    }


    container.innerHTML = "";


    withdrawals.reverse().forEach(w => {

        container.innerHTML += `

            <div class="history-item">

                <div>

                    <strong>
                        ${w.amount.toLocaleString()} PTS
                    </strong>

                    <small style="
                        display:block;
                        color:#718096;
                        margin-top:4px;
                    ">
                        ₦${w.naira.toFixed(2)}
                    </small>

                </div>

                <span class="status ${
                    w.status === "approved"
                        ? "approved"
                        : "pending"
                }">
                    ${w.status}
                </span>

            </div>

        `;

    });

}


/* =====================================================
   PROFILE
   ===================================================== */

function renderProfile() {

    const user = getUser();

    document.getElementById("profileName").textContent =
        user.name;

    document.getElementById("profileEmail").textContent =
        user.email;

    document.getElementById("profileUsername").textContent =
        user.username;

    document.getElementById("registrationDate").textContent =
        new Date(user.registeredAt).toLocaleDateString();

}


function changePassword() {

    const user = getUser();

    const current =
        document.getElementById("currentPassword").value;

    const newPassword =
        document.getElementById("newPassword").value;

    const confirm =
        document.getElementById("confirmNewPassword").value;


    if (current !== user.password) {

        toast("Current password is incorrect.");

        return;
    }


    if (newPassword.length < 6) {

        toast("New password must be at least 6 characters.");

        return;
    }


    if (newPassword !== confirm) {

        toast("Passwords do not match.");

        return;
    }


    user.password = newPassword;

    saveState();

    toast("Password updated successfully.");

}


function renderEarnings() {

    const user = getUser();

    const container =
        document.getElementById("earningsHistory");


    const transactions =
        state.transactions.filter(
            t => t.userId === user.id
        );


    if (!transactions.length) {

        container.innerHTML = `
            <p style="
                color:#718096;
                font-size:13px;
            ">
                No earnings yet.
            </p>
        `;

        return;
    }


    container.innerHTML = "";


    transactions.reverse().forEach(t => {

        container.innerHTML += `

            <div class="history-item">

                <div>
                    <strong>${t.description}</strong>

                    <small style="
                        display:block;
                        color:#718096;
                        margin-top:4px;
                    ">
                        ${new Date(t.date).toLocaleString()}
                    </small>
                </div>

                <strong style="color:#16a34a">
                    +${t.amount} PTS
                </strong>

            </div>

        `;

    });

}


/* =====================================================
   TRANSACTIONS
   ===================================================== */

function addTransaction(
    userId,
    type,
    amount,
    description
) {

    state.transactions.push({

        id: Date.now(),

        userId,

        type,

        amount,

        description,

        date: new Date().toISOString()

    });

}


/* =====================================================
   ADMIN
   ===================================================== */

function isAdmin() {

    const user = getUser();

    return user &&
        (
            user.isAdmin ||
            user.email === MASTER_ADMIN
        );

}


function renderAdmin() {

    if (!isAdmin()) return;


    document.getElementById("adminUsers").textContent =
        state.users.length;

    document.getElementById("adminTasks").textContent =
        state.tasks.length;

    document.getElementById("adminSubmissions").textContent =
        state.submissions.filter(
            s => s.status === "pending"
        ).length;

    document.getElementById("adminWithdrawals").textContent =
        state.withdrawals.filter(
            w => w.status === "pending"
        ).length;


    document.getElementById("adminConversion").value =
        state.settings.conversionRate;

    document.getElementById("adminReferralReward").value =
        state.settings.referralReward;


    renderAdminTasks();

    renderAdminSubmissions();

    renderAdminUsers();

}


function renderAdminTasks() {

    const container =
        document.getElementById("adminTasksList");

    container.innerHTML = "";


    state.tasks.forEach((task, index) => {

        container.innerHTML += `

            <div class="admin-task">

                <div>

                    <strong>
                        ${task.name}
                    </strong>

                    <small style="
                        display:block;
                        color:#718096;
                    ">
                        ${task.reward} PTS
                    </small>

                </div>

                <div>

                    <button
                        onclick="moveTask(${index}, -1)"
                        style="padding:6px"
                    >
                        ↑
                    </button>

                    <button
                        onclick="moveTask(${index}, 1)"
                        style="padding:6px"
                    >
                        ↓
                    </button>

                    <button
                        onclick="deleteTask(${task.id})"
                        style="
                            padding:6px;
                            color:#ef4444;
                        "
                    >
                        Delete
                    </button>

                </div>

            </div>
        `;

    });

}


function addTask() {

    const name =
        prompt("Task name:");

    if (!name) return;


    const reward =
        Number(prompt("Reward in PTS:"));


    if (!reward) return;


    state.tasks.push({

        id: Date.now(),

        name,

        description:
            "Complete this task and submit your proof.",

        reward,

        link: "#",

        status: "active"

    });


    saveState();

    renderAll();

    toast("Task added.");

}


function deleteTask(id) {

    if (!confirm("Delete this task?")) return;


    state.tasks =
        state.tasks.filter(
            task => task.id !== id
        );


    saveState();

    renderAll();

}


function moveTask(index, direction) {

    const newIndex =
        index + direction;


    if (
        newIndex < 0 ||
        newIndex >= state.tasks.length
    ) return;


    const temp =
        state.tasks[index];

    state.tasks[index] =
        state.tasks[newIndex];

    state.tasks[newIndex] =
        temp;


    saveState();

    renderAll();

}


function renderAdminSubmissions() {

    const container =
        document.getElementById("adminSubmissionsList");


    const pending =
        state.submissions.filter(
            s => s.status === "pending"
        );


    if (!pending.length) {

        container.innerHTML = `
            <p style="
                color:#718096;
                font-size:13px;
            ">
                No pending submissions.
            </p>
        `;

        return;
    }


    container.innerHTML = "";


    pending.forEach(submission => {

        const user =
            state.users.find(
                u => u.id === submission.userId
            );

        const task =
            state.tasks.find(
                t => t.id === submission.taskId
            );


        if (!user || !task) return;


        container.innerHTML += `

            <div class="submission-item">

                <div>

                    <strong>
                        ${user.username}
                    </strong>

                    <small style="
                        display:block;
                        color:#718096;
                    ">
                        ${task.name}
                    </small>

                    <small>
                        ${submission.proof}
                    </small>

                </div>

                <div>

                    <button
                        class="claim-btn"
                        onclick="approveSubmission(${submission.id})"
                    >
                        Approve
                    </button>

                    <button
                        onclick="declineSubmission(${submission.id})"
                        style="
                            padding:7px;
                            color:#ef4444;
                            background:#fee2e2;
                            border-radius:8px;
                        "
                    >
                        Decline
                    </button>

                </div>

            </div>

        `;

    });

}


function approveSubmission(id) {

    const submission =
        state.submissions.find(
            s => s.id === id
        );


    if (!submission) return;


    const user =
        state.users.find(
            u => u.id === submission.userId
        );

    const task =
        state.tasks.find(
            t => t.id === submission.taskId
        );


    if (!user || !task) return;


    if (submission.status !== "pending") return;


    submission.status = "approved";


    if (!user.completedTasks.includes(task.id)) {

        user.completedTasks.push(task.id);

        user.taskBalance += task.reward;


        addTransaction(

            user.id,

            "task",

            task.reward,

            `Completed: ${task.name}`

        );

    }


    state.notifications.push({

        userId: user.id,

        text:
            `Your task "${task.name}" was approved. +${task.reward} PTS`,

        date: new Date().toISOString()

    });


    saveState();

    renderAll();

    toast("Submission approved.");

}


function declineSubmission(id) {

    const submission =
        state.submissions.find(
            s => s.id === id
        );


    if (!submission) return;


    submission.status = "declined";


    saveState();

    renderAll();

    toast("Submission declined.");

}


function approveAll() {

    const pending =
        state.submissions.filter(
            s => s.status === "pending"
        );


    pending.forEach(s => {

        approveSubmission(s.id);

    });


    toast("All pending submissions processed.");

}


function renderAdminUsers() {

    const container =
        document.getElementById("adminUsersList");


    container.innerHTML = "";


    state.users.forEach(user => {

        container.innerHTML += `

            <div class="user-item">

                <div>

                    <strong>
                        ${user.username}
                    </strong>

                    <small style="
                        display:block;
                        color:#718096;
                    ">
                        ${user.email}
                    </small>

                </div>

                <div>

                    <strong>
                        ${(
                            user.taskBalance +
                            user.referralBalance
                        ).toLocaleString()}
                        PTS
                    </strong>

                    ${
                        user.banned

                        ? `<button
                            onclick="unbanUser(${user.id})"
                            style="
                                display:block;
                                color:#16a34a;
                                background:none;
                                margin-top:5px;
                            "
                           >
                            Unban
                           </button>`

                        : `<button
                            onclick="banUser(${user.id})"
                            style="
                                display:block;
                                color:#ef4444;
                                background:none;
                                margin-top:5px;
                            "
                           >
                            Ban
                           </button>`
                    }

                </div>

            </div>
        `;

    });

}


function banUser(id) {

    const user =
        state.users.find(u => u.id === id);

    if (!user) return;


    user.banned = true;

    saveState();

    renderAll();

    toast("User banned.");

}


function unbanUser(id) {

    const user =
        state.users.find(u => u.id === id);

    if (!user) return;


    user.banned = false;

    saveState();

    renderAll();

    toast("User unbanned.");

}


function saveAdminSettings() {

    if (!isAdmin()) return;


    state.settings.conversionRate =
        Number(
            document.getElementById("adminConversion").value
        );


    state.settings.referralReward =
        Number(
            document.getElementById("adminReferralReward").value
        );


    saveState();

    calculateWithdrawal();

    toast("Settings saved.");

}


/* =====================================================
   COMMUNITY
   ===================================================== */

function openCommunity() {

    document
        .getElementById("communityModal")
        .classList.remove("hidden");

}


function closeModal(id) {

    document
        .getElementById(id)
        .classList.add("hidden");

}


/* =====================================================
   NOTIFICATIONS
   ===================================================== */

function renderNotifications() {

    const user = getUser();

    if (!user) return;


    const notifications =
        state.notifications.filter(
            n => n.userId === user.id
        );


    document.getElementById("notificationCount")
        .textContent = notifications.length;


    const list =
        document.getElementById("notificationsList");


    if (!notifications.length) {

        list.innerHTML = `
            <p style="
                color:#718096;
                padding:15px 0;
                font-size:13px;
            ">
                No notifications.
            </p>
        `;

        return;
    }


    list.innerHTML = "";


    notifications.slice().reverse().forEach(n => {

        list.innerHTML += `

            <div class="notification">

                ${n.text}

                <small style="
                    display:block;
                    color:#94a3b8;
                    margin-top:5px;
                ">
                    ${new Date(n.date).toLocaleString()}
                </small>

            </div>

        `;

    });

}


function openNotifications() {

    document
        .getElementById("notificationPanel")
        .classList.remove("hidden");

}


function closeNotifications() {

    document
        .getElementById("notificationPanel")
        .classList.add("hidden");

}


/* =====================================================
   TOAST
   ===================================================== */

let toastTimer;


function toast(message) {

    const element =
        document.getElementById("toast");


    element.textContent = message;

    element.classList.add("show");


    clearTimeout(toastTimer);


    toastTimer = setTimeout(() => {

        element.classList.remove("show");

    }, 3000);

}
