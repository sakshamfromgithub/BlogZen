import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  sendEmailVerification,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  onSnapshot,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// --- Firebase Initialization ---
const firebaseConfig = {
  apiKey: "AIzaSyA8wP3PNiVCYJ4B9DsDat3-st9-R1JYsxU",
  authDomain: "blogzen-6191a.firebaseapp.com",
  projectId: "blogzen-6191a",
  storageBucket: "blogzen-6191a.firebasestorage.app",
  messagingSenderId: "1073288426681",
  appId: "1:1073288426681:web:8bb7da62cff7bb3cda1768",
  measurementId: "G-4MGC1TQ2MB",
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

// --- Global State ---
let currentUser = null;
let lastVisiblePost = null;
let allLoadedPosts = [];

const getUrlParam = (name) =>
  new URLSearchParams(window.location.search).get(name);
const formatDate = (timestamp) =>
  timestamp ? new Date(timestamp.toDate()).toLocaleDateString() : "";

// --- Fetch User Data from Firestore ---
async function fetchUserData(uid) {
  const userDoc = await getDoc(doc(db, "users", uid));
  if (userDoc.exists()) return userDoc.data();
  return null;
}

// --- Navbar & Dark Mode ---
function loadNavbar() {
  const nav = document.getElementById("navbar-container");
  if (!nav) return;

  const isDark = localStorage.getItem("theme") === "dark";
  if (isDark) document.documentElement.setAttribute("data-theme", "dark");

  // Show Name if available, else fallback to email
  const displayName = currentUser?.name || currentUser?.email || "User";

  nav.innerHTML = `
        <nav>
            <a href="index.html" class="logo">BlogsZen</a>
            <div class="nav-links">
                <button id="theme-toggle" class="secondary" style="padding: 5px 10px;">${isDark ? "☀️ Light" : "🌙 Dark"}</button>
                ${
                  currentUser
                    ? `
                    <span style="font-size: 0.9rem;">Hi, ${displayName}</span>
                    <a href="dashboard.html" class="button secondary" style="padding: 8px 16px; border-radius: 4px;">Dashboard</a>
                    <button id="logout-btn" class="secondary">Logout</button>
                `
                    : `
                    <a href="auth.html" class="button" style="padding: 8px 16px; border-radius: 4px;">Login</a>
                `
                }
            </div>
        </nav>
    `;

  document.getElementById("theme-toggle").addEventListener("click", () => {
    const isCurrentlyDark =
      document.documentElement.getAttribute("data-theme") === "dark";
    document.documentElement.setAttribute(
      "data-theme",
      isCurrentlyDark ? "light" : "dark",
    );
    localStorage.setItem("theme", isCurrentlyDark ? "light" : "dark");
    loadNavbar();
  });

  if (currentUser)
    document
      .getElementById("logout-btn")
      .addEventListener("click", () => signOut(auth));
}

// --- Auth State Listener ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // CHECK IF USER JUST VERIFIED THEIR EMAIL
    if (
      user.emailVerified &&
      localStorage.getItem("pendingVerification") === "true"
    ) {
      localStorage.removeItem("pendingVerification");
      alert("Your email verified successfully");
      window.location.href = "index.html";
      return; // Stop script execution so page doesn't load partially
    }

    // Fetch custom user data (Name) from Firestore
    const userData = await fetchUserData(user.uid);
    currentUser = {
      uid: user.uid,
      email: user.email,
      name: userData?.name || user.displayName || null,
    };
  } else {
    currentUser = null;
  }
  loadNavbar();
  initPage();
});

function initPage() {
  const path = window.location.pathname;
  if (path.includes("index.html") || path === "/" || path.includes("localhost"))
    initHomePage();
  if (path.includes("post.html")) initPostPage();
  if (path.includes("dashboard.html")) initDashboard();
  if (path.includes("auth.html")) initAuthPage();
}

// ==========================================
// 1. HOMEPAGE (index.html)
// ==========================================
async function initHomePage() {
  await loadPosts();
  loadRecentPosts();
  document.getElementById("load-more-btn").addEventListener("click", loadPosts);
  document
    .getElementById("search-input")
    .addEventListener("input", filterPosts);
  document
    .getElementById("category-filter")
    .addEventListener("change", filterPosts);
}

async function loadPosts() {
  const container = document.getElementById("posts-container");
  let q = query(
    collection(db, "posts"),
    orderBy("createdAt", "desc"),
    limit(5),
  );
  if (lastVisiblePost)
    q = query(
      collection(db, "posts"),
      orderBy("createdAt", "desc"),
      startAfter(lastVisiblePost),
      limit(5),
    );

  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    document.getElementById("load-more-btn").classList.add("hidden");
    if (allLoadedPosts.length === 0)
      container.innerHTML = "<p>No posts found.</p>";
    return;
  }
  snapshot.forEach((doc) => {
    allLoadedPosts.push({ id: doc.id, ...doc.data() });
    lastVisiblePost = doc;
  });
  renderPosts(allLoadedPosts);
}

function filterPosts() {
  const search = document.getElementById("search-input").value.toLowerCase();
  const cat = document.getElementById("category-filter").value;
  const filtered = allLoadedPosts.filter((p) => {
    const matchText =
      p.title.toLowerCase().includes(search) ||
      p.content.toLowerCase().includes(search);
    const matchCat = cat === "" || p.category === cat;
    return matchText && matchCat;
  });
  renderPosts(filtered);
}

function renderPosts(posts) {
  const container = document.getElementById("posts-container");
  container.innerHTML = posts
    .map(
      (p) => `
        <div class="post-card" onclick="window.location.href='post.html?id=${p.id}'">
            ${p.imageUrl ? `<img src="${p.imageUrl}" alt="${p.title}">` : ""}
            <span class="badge">${p.category || "General"}</span>
            <h2>${p.title}</h2>
            <div class="post-meta">By ${p.authorName} on ${formatDate(p.createdAt)}</div>
            <p>${p.content.substring(0, 150).replace(/\n/g, "<br>")}...</p>
        </div>
    `,
    )
    .join("");
}

async function loadRecentPosts() {
  const q = query(
    collection(db, "posts"),
    orderBy("createdAt", "desc"),
    limit(5),
  );
  const snapshot = await getDocs(q);
  const ul = document.getElementById("recent-posts");
  ul.innerHTML = snapshot.docs
    .map(
      (doc) =>
        `<li style="margin-bottom: 10px;"><a href="post.html?id=${doc.id}">${doc.data().title}</a></li>`,
    )
    .join("");
}

// ==========================================
// 2. SINGLE POST (post.html)
// ==========================================
async function initPostPage() {
  const postId = getUrlParam("id");
  if (!postId) return (window.location = "index.html");

  const docSnap = await getDoc(doc(db, "posts", postId));
  if (!docSnap.exists())
    return (document.getElementById("single-post-container").innerHTML =
      "<p>Post not found.</p>");

  const post = { id: docSnap.id, ...docSnap.data() };
  document.title = `${post.title} - BlogZen`;

  document.getElementById("single-post-container").innerHTML = `
        ${post.imageUrl ? `<img src="${post.imageUrl}" style="width:100%; max-height:450px; object-fit:cover; border-radius:8px; margin-bottom:20px; box-shadow: var(--shadow);" alt="Post Image">` : '<p style="color:var(--text-secondary); margin-bottom:20px;">[No Image]</p>'}
        <span class="badge">${post.category}</span>
        <h1 style="margin: 10px 0;">${post.title}</h1>
        <!-- FIXED: Changed p.createdAt to post.createdAt -->
        <div class="post-meta" style="margin-bottom: 20px;">By ${post.authorName} on ${formatDate(post.createdAt)}</div>
        <div style="line-height: 1.8; font-size: 1.1rem;"> ${marked.parse(post.content)}</div>
        <div style="margin-top: 30px;">
            <button class="like-btn" id="like-btn">❤️ <span id="like-count">0</span></button>
        </div>
        <div class="ad-placeholder" style="margin-top: 30px;">AdSense Code Here</div>
    `;

  document
    .querySelector('meta[name="description"]')
    .setAttribute("content", post.title);

  initLikes(postId);
  initComments(postId);
}

async function initLikes(postId) {
  const likeBtn = document.getElementById("like-btn");
  const likeCount = document.getElementById("like-count");
  const likesCol = collection(db, `posts/${postId}/likes`);

  const snapshot = await getDocs(likesCol);
  likeCount.innerText = snapshot.size;

  if (currentUser) {
    const userLikeDoc = await getDoc(doc(likesCol, currentUser.uid));
    if (userLikeDoc.exists()) likeBtn.classList.add("liked");
  }

  likeBtn.onclick = async () => {
    if (!currentUser) return alert("Please login to like posts.");
    const likeDoc = doc(db, `posts/${postId}/likes`, currentUser.uid);
    const snap = await getDoc(likeDoc);

    if (snap.exists()) {
      await deleteDoc(likeDoc);
      likeBtn.classList.remove("liked");
      likeCount.innerText = parseInt(likeCount.innerText) - 1;
    } else {
      await setDoc(likeDoc, { timestamp: serverTimestamp() });
      likeBtn.classList.add("liked");
      likeCount.innerText = parseInt(likeCount.innerText) + 1;
    }
  };
}

function initComments(postId) {
  const comContainer = document.getElementById("comments-container");
  const q = query(
    collection(db, `posts/${postId}/comments`),
    orderBy("createdAt", "desc"),
  );

  onSnapshot(q, (snapshot) => {
    comContainer.innerHTML = snapshot.docs
      .map((d) => {
        const c = d.data();
        return `<div class="comment-item"><strong>${c.authorName}</strong> <small>${formatDate(c.createdAt)}</small><p style="margin-top:5px;">${c.text}</p></div>`;
      })
      .join("");
  });

  document
    .getElementById("submit-comment")
    .addEventListener("click", async () => {
      if (!currentUser) return alert("Login to comment!");
      const input = document.getElementById("comment-input");
      if (!input.value.trim()) return;
      await addDoc(collection(db, `posts/${postId}/comments`), {
        text: input.value.trim(),
        authorId: currentUser.uid,
        authorName: currentUser.name || currentUser.email.split("@")[0],
        createdAt: serverTimestamp(),
      });
      input.value = "";
    });
}

// ==========================================
// 3. DASHBOARD (dashboard.html)
// ==========================================
async function initDashboard() {
  if (!currentUser) return (window.location = "auth.html");
  loadUserPosts();
  document
    .getElementById("submit-post")
    .addEventListener("click", handlePostSubmit);
  document
    .getElementById("post-image")
    .addEventListener("change", handleImageUpload);
}

let uploadedImageUrl = "";

async function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const progressDiv = document.getElementById("upload-progress");
  progressDiv.classList.remove("hidden");
  progressDiv.innerText = "Uploading image...";

  const storageRef = ref(storage, `images/${Date.now()}_${file.name}`);
  const uploadTask = uploadBytesResumable(storageRef, file);

  uploadTask.on(
    "state_changed",
    () => {},
    (error) => {
      alert("Upload failed");
      progressDiv.classList.add("hidden");
    },
    () => {
      getDownloadURL(uploadTask.snapshot.ref).then((url) => {
        uploadedImageUrl = url;
        progressDiv.innerText = "Image uploaded successfully!";
        setTimeout(() => progressDiv.classList.add("hidden"), 2000);
      });
    },
  );
}

async function handlePostSubmit() {
  const id = document.getElementById("post-id").value;
  const title = document.getElementById("post-title").value;
  const category = document.getElementById("post-category").value;
  const content = document.getElementById("post-content").value;
  if (!title || !content) return alert("Title and Content required!");

  const postData = { title, category, content, imageUrl: uploadedImageUrl };

  try {
    if (id) {
      await updateDoc(doc(db, "posts", id), postData);
      alert("Post updated successfully!");
    } else {
      await addDoc(collection(db, "posts"), {
        ...postData,
        authorId: currentUser.uid,
        authorName: currentUser.name || currentUser.email.split("@")[0],
        createdAt: serverTimestamp(),
      });
      alert("Post published successfully!");
    }
    window.location.href = "index.html";
  } catch (err) {
    alert("Error: " + err.message);
  }
}

async function loadUserPosts() {
  if (!currentUser) return;
  const q = query(
    collection(db, "posts"),
    where("authorId", "==", currentUser.uid),
    orderBy("createdAt", "desc"),
  );
  const snapshot = await getDocs(q);
  const container = document.getElementById("user-posts-container");

  container.innerHTML = snapshot.docs
    .map((doc) => {
      const p = doc.data();
      return `
            <div class="post-card" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                <div style="flex:1; cursor:pointer;" onclick="window.location.href='post.html?id=${doc.id}'">
                    <h3>${p.title}</h3>
                    <small>${formatDate(p.createdAt)}</small>
                </div>
                <div style="display:flex; gap:10px;">
                    <button class="secondary" onclick="window.location.href='dashboard.html?edit=${doc.id}'">Edit</button>
                    <button style="background:red;" onclick="deletePost('${doc.id}')">Delete</button>
                </div>
            </div>
        `;
    })
    .join("");

  const editId = getUrlParam("edit");
  if (editId) {
    const editDoc = await getDoc(doc(db, "posts", editId));
    if (editDoc.exists()) {
      const p = editDoc.data();
      document.getElementById("form-title").innerText = "Edit Post";
      document.getElementById("post-id").value = editId;
      document.getElementById("post-title").value = p.title;
      document.getElementById("post-category").value = p.category;
      document.getElementById("post-content").value = p.content;
      uploadedImageUrl = p.imageUrl;
    }
  }
}

async function deletePost(id) {
  if (confirm("Are you sure you want to delete this post?")) {
    await deleteDoc(doc(db, "posts", id));
    alert("Post deleted.");
    window.location.href = "index.html";
  }
}
window.deletePost = deletePost;

// ==========================================
// 4. AUTH (auth.html)
// ==========================================
let isLoginMode = true;

function initAuthPage() {
  if (currentUser) return (window.location = "index.html");

  const submitBtn = document.getElementById("auth-submit-btn");
  const toggleLink = document.getElementById("auth-toggle-link");
  const toggleText = document.getElementById("auth-toggle-text");
  const nameInput = document.getElementById("auth-name");
  const msgDiv = document.getElementById("auth-message");

  // Close button logic
  document
    .getElementById("close-btn")
    .addEventListener("click", () => (window.location.href = "index.html"));

  // If they refresh the page while waiting for verification, keep showing the message
  if (localStorage.getItem("pendingVerification") === "true") {
    msgDiv.innerText =
      "Please verify your email from your inbox. Check spam folder also.";
  }

  toggleLink.addEventListener("click", (e) => {
    e.preventDefault();
    isLoginMode = !isLoginMode;
    document.getElementById("auth-title").innerText = isLoginMode
      ? "Login"
      : "Sign Up";
    submitBtn.innerText = isLoginMode ? "Login" : "Sign Up";
    toggleText.innerText = isLoginMode
      ? "Don't have an account? "
      : "Already have an account? ";
    toggleLink.innerText = isLoginMode ? "Sign Up" : "Login";

    if (isLoginMode) {
      nameInput.classList.add("hidden");
    } else {
      nameInput.classList.remove("hidden");
    }
  });

  submitBtn.addEventListener("click", handleEmailAuth);
  document
    .getElementById("google-auth-btn")
    .addEventListener("click", handleGoogleAuth);
}

async function handleEmailAuth() {
  const name = document.getElementById("auth-name").value.trim();
  const email = document.getElementById("auth-email").value;
  const password = document.getElementById("auth-password").value;
  const msgDiv = document.getElementById("auth-message");

  try {
    if (isLoginMode) {
      const cred = await signInWithEmailAndPassword(auth, email, password);

      // 🔥 IMPORTANT: latest status lene ke liye
      await cred.user.reload();

      if (!cred.user.emailVerified) {
        await sendEmailVerification(cred.user, {
          url: "http://localhost:5500/index.html",
          handleCodeInApp: false,
        });
        console.log("Email sent ✅");

        localStorage.setItem("pendingVerification", "true");

        await signOut(auth);

        msgDiv.innerText =
          "Please verify your email from inbox. Check spam also.";
        return;
      }

      // Agar verified hai → onAuthStateChanged handle karega redirect
    } else {
      if (!name) return alert("Please enter your name.");
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      // Save user name to Firestore
      await setDoc(doc(db, "users", cred.user.uid), {
        name: name,
        email: email,
      });

      // Send verification email
      await sendEmailVerification(cred.user, {
        url: "http://localhost:5500/index.html",
        handleCodeInApp: false,
      });

      localStorage.setItem("pendingVerification", "true");

      await signOut(auth);
    }

    msgDiv.innerText = "Please verify your email from inbox. Check spam also.";
  } catch (err) {
    msgDiv.innerText = err.message;
    console.error("Email error ❌", err);
  }
}

async function handleGoogleAuth() {
  try {
    const result = await signInWithPopup(auth, provider);
    // Google accounts are pre-verified, so no need to check emailVerified
    const userDoc = await getDoc(doc(db, "users", result.user.uid));
    if (!userDoc.exists()) {
      await setDoc(doc(db, "users", result.user.uid), {
        name: result.user.displayName || "Anonymous",
        email: result.user.email,
      });
    }
  } catch (err) {
    console.error(err);
  }
}
