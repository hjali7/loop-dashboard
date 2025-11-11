/*
 * فایل نهایی newtab.js
 * شامل: منطق کامل برای همه‌ی ویجت‌ها با استفاده از chrome.storage
 */

// --- کلید API آب و هوا ---
// !!! کلید API رایگان خود را از openweathermap.org دریافت و اینجا جایگزین کنید
const WEATHER_API_KEY = 'YOUR_API_KEY_HERE'; 

document.addEventListener('DOMContentLoaded', () => {

    // --- ۰. ماژول تغییر تم ---
    setupThemeToggle();

    // --- ۱. ماژول ساعت و خوش‌آمدگویی ---
    setupClockAndGreeting();

    // --- ۲. ماژول آب و هوا ---
    setupWeather();

    // --- ۳. ماژول لیست کارها ---
    setupTodos();

    // --- ۴. ماژول یادداشت‌های سریع ---
    setupNotes();

    // --- ۵. ماژول پیوندهای سفارشی ---
    setupLinks();

    // --- ۶. ماژول پومودورو (مدرن) ---
    setupPomodoro();

});

// -------------------------------------------------------------------
// --- پیاده‌سازی ماژول‌ها ---
// -------------------------------------------------------------------

function setupThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    const themeStorageKey = 'devDashboardTheme';
    if (!themeToggle) return;

    // بارگذاری تم ذخیره شده
    chrome.storage.local.get([themeStorageKey], (result) => {
        if (result[themeStorageKey] === 'light') {
            document.body.classList.add('light-mode');
            themeToggle.checked = true;
        } else {
            document.body.classList.remove('light-mode');
            themeToggle.checked = false;
        }
    });

    // ذخیره تم هنگام تغییر
    themeToggle.addEventListener('change', () => {
        let newTheme = 'dark';
        if (themeToggle.checked) {
            document.body.classList.add('light-mode');
            newTheme = 'light';
        } else {
            document.body.classList.remove('light-mode');
        }
        chrome.storage.local.set({ [themeStorageKey]: newTheme });
    });
}

function setupClockAndGreeting() {
    const timeElement = document.getElementById('clock-display');
    const greetingElement = document.getElementById('greeting-display');

    function updateClock() {
        const now = new Date();
        const hours = now.getHours();
        
        const timeString = now.toLocaleTimeString('fa-IR', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });
        if (timeElement) timeElement.textContent = timeString;

        // خوشامدگویی پویا
        let greeting = '';
        if (hours < 5) greeting = 'شب بخیر!';
        else if (hours < 12) greeting = 'صبح بخیر!';
        else if (hours < 18) greeting = 'ظهر بخیر!';
        else if (hours < 22) greeting = 'عصر بخیر!';
        else greeting = 'شب بخیر!';
        
        if (greetingElement && greetingElement.textContent !== greeting) {
            greetingElement.textContent = greeting;
        }
    }
    setInterval(updateClock, 1000);
    updateClock();
}

function setupWeather() {
    const loadingElement = document.getElementById('weather-loading');
    const container = document.getElementById('weather-container');
    if (!container) return;

    if (WEATHER_API_KEY === 'YOUR_API_KEY_HERE') {
        loadingElement.textContent = 'کلید API آب و هوا تنظیم نشده است.';
        return;
    }

    function getWeather() {
        // ۱. تلاش برای خواندن از کش (برای جلوگیری از درخواست‌های مکرر)
        chrome.storage.local.get(['weatherCache', 'weatherCacheTime'], (result) => {
            const now = new Date().getTime();
            // کش برای ۳۰ دقیقه معتبر است (30 * 60 * 1000 = 1800000ms)
            if (result.weatherCache && result.weatherCacheTime && (now - result.weatherCacheTime < 1800000)) {
                displayWeather(result.weatherCache);
            } else {
                // اگر کش معتبر نبود، از geolocation استفاده کن
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const { latitude, longitude } = position.coords;
                        fetchWeather(latitude, longitude);
                    },
                    (error) => {
                        console.error("خطای Geolocation:", error);
                        loadingElement.textContent = 'امکان دسترسی به موقعیت مکانی نیست.';
                    }
                );
            }
        });
    }

    async function fetchWeather(lat, lon) {
        try {
            const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${WEATHER_API_KEY}&units=metric&lang=fa`);
            if (!response.ok) throw new Error('پاسخ شبکه ناموفق بود');
            const data = await response.json();
            
            // ذخیره در کش
            chrome.storage.local.set({
                'weatherCache': data,
                'weatherCacheTime': new Date().getTime()
            });

            displayWeather(data);
        } catch (error) {
            console.error("خطای دریافت آب و هوا:", error);
            loadingElement.textContent = 'خطا در دریافت اطلاعات آب و هوا.';
        }
    }

    function displayWeather(data) {
        const temp = Math.round(data.main.temp);
        const description = data.weather[0].description;
        const icon = data.weather[0].icon;

        container.innerHTML = `
            <div id="weather-info" class="weather-info">
                <span id="weather-temp">${temp}°C</span>
                <span id="weather-desc">${description}</span>
                <img id="weather-icon" src="https://openweathermap.org/img/wn/${icon}.png" alt="${description}">
            </div>
        `;
    }

    getWeather();
}

function setupTodos() {
    const todoForm = document.getElementById('todo-form');
    const todoInput = document.getElementById('todo-input');
    const todoList = document.getElementById('todo-list');
    const todoStorageKey = 'devDashboardTodos';
    let todos = [];

    if (!todoForm) return;

    async function loadTodos() {
        const result = await chrome.storage.local.get([todoStorageKey]);
        todos = result[todoStorageKey] || [];
        renderTodos();
    }

    function renderTodos() {
        if (!todoList) return;
        todoList.innerHTML = ''; 
        if (todos.length === 0) {
            todoList.innerHTML = '<p class="text-center" style="opacity: 0.5; color: var(--text-color-light);">کاری برای انجام نیست.</p>';
            return;
        }
        todos.forEach((todo, index) => {
            const todoItem = document.createElement('div');
            todoItem.className = 'todo-item';
            
            const todoText = document.createElement('span');
            todoText.textContent = todo.text;
            todoText.className = 'todo-text';
            if (todo.completed) {
                todoText.classList.add('completed');
            }
            todoText.addEventListener('click', () => toggleTodo(index));
            
            const deleteButton = document.createElement('button');
            deleteButton.textContent = '×';
            deleteButton.className = 'todo-delete-btn';
            deleteButton.addEventListener('click', () => deleteTodo(index));

            todoItem.appendChild(todoText);
            todoItem.appendChild(deleteButton);
            todoList.appendChild(todoItem);
        });
    }

    async function saveTodos() {
        await chrome.storage.local.set({ [todoStorageKey]: todos });
    }

    todoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newTodoText = todoInput.value.trim();
        if (newTodoText) {
            todos.push({ text: newTodoText, completed: false });
            todoInput.value = '';
            await saveTodos();
            renderTodos();
        }
    });

    async function toggleTodo(index) {
        todos[index].completed = !todos[index].completed;
        await saveTodos();
        renderTodos();
    }

    async function deleteTodo(index) {
        todos.splice(index, 1);
        await saveTodos();
        renderTodos();
    }
    
    loadTodos();
}

function setupNotes() {
    const notesTextarea = document.getElementById('notes-textarea');
    const notesStorageKey = 'devDashboardNotes';
    let notesTimer = null; 
    if (!notesTextarea) return;

    // بارگذاری یادداشت‌ها
    chrome.storage.local.get([notesStorageKey], (result) => {
        notesTextarea.value = result[notesStorageKey] || '';
    });

    // ذخیره کردن با Debounce
    notesTextarea.addEventListener('keyup', () => {
        if (notesTimer) {
            clearTimeout(notesTimer);
        }
        notesTimer = setTimeout(() => {
            chrome.storage.local.set({ [notesStorageKey]: notesTextarea.value });
        }, 300);
    });
}

function setupLinks() {
    const linksGrid = document.getElementById('links-grid');
    const addLinkForm = document.getElementById('add-link-form');
    const linkNameInput = document.getElementById('link-name-input');
    const linkUrlInput = document.getElementById('link-url-input');
    const linksStorageKey = 'devDashboardLinks';
    let links = [];

    if (!addLinkForm) return;

    async function loadLinks() {
        const result = await chrome.storage.local.get([linksStorageKey]);
        links = result[linksStorageKey] || [
            { name: "گیت‌هاب", url: "https://github.com" },
            { name: "Stack Overflow", url: "https://stackoverflow.com" },
            { name: "Dev.to", url: "https://dev.to" }
        ];
        renderLinks();
    }

    function renderLinks() {
        if (!linksGrid) return;
        linksGrid.innerHTML = '';
        links.forEach((link, index) => {
            const linkCard = document.createElement('a');
            linkCard.href = link.url.startsWith('http') ? link.url : 'https://' + link.url;
            linkCard.target = '_blank';
            linkCard.className = 'glass-effect link-card';
            
            const linkText = document.createElement('span');
            linkText.className = 'link-text';
            linkText.textContent = link.name;
            
            const deleteButton = document.createElement('button');
            deleteButton.textContent = '×';
            deleteButton.className = 'link-delete-btn';
            
            deleteButton.addEventListener('click', (e) => {
                e.preventDefault(); 
                e.stopPropagation(); 
                deleteLink(index);
            });
            
            linkCard.appendChild(linkText);
            linkCard.appendChild(deleteButton);
            linksGrid.appendChild(linkCard);
        });
    }

    async function saveLinks() {
        await chrome.storage.local.set({ [linksStorageKey]: links });
    }

    addLinkForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = linkNameInput.value.trim();
        const url = linkUrlInput.value.trim();
        
        if (name && url) {
            links.push({ name, url });
            linkNameInput.value = '';
            linkUrlInput.value = '';
            await saveLinks();
            renderLinks();
        }
    });

    async function deleteLink(index) {
        links.splice(index, 1);
        await saveLinks();
        renderLinks();
    }
    
    loadLinks();
}

function setupPomodoro() {
    const timeDisplay = document.getElementById('pomo-time-display');
    const stageDisplay = document.getElementById('pomo-stage-display');
    const startBtn = document.getElementById('pomo-start-btn');
    const resetBtn = document.getElementById('pomo-reset-btn');
    const progressRing = document.querySelector('.pomo-progress-ring');
    
    if (!timeDisplay) return;

    const stages = {
        POMODORO: 25 * 60,
        SHORT_BREAK: 5 * 60,
        LONG_BREAK: 15 * 60,
    };
    
    const stageNames = {
        POMODORO: 'زمان کار',
        SHORT_BREAK: 'استراحت کوتاه',
        LONG_BREAK: 'استراحت طولانی',
    };

    let currentStage = 'POMODORO';
    let pomoCount = 0;
    let timerInterval = null;
    let totalSeconds = stages[currentStage];
    let currentSeconds = totalSeconds;
    let isRunning = false;

    // تنظیمات SVG
    const radius = progressRing.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;
    progressRing.style.strokeDasharray = `${circumference} ${circumference}`;
    progressRing.style.strokeDashoffset = 0;
    
    function updateDisplay() {
        const minutes = Math.floor(currentSeconds / 60);
        const seconds = currentSeconds % 60;
        timeDisplay.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        
        // به‌روزرسانی نوار دایره‌ای
        const offset = circumference - (currentSeconds / totalSeconds) * circumference;
        progressRing.style.strokeDashoffset = offset;
    }

    function startTimer() {
        isRunning = true;
        startBtn.textContent = 'توقف';
        stageDisplay.textContent = stageNames[currentStage];
        
        if (currentStage === 'POMODORO') {
            progressRing.style.stroke = 'var(--brand-color)'; // رنگ اصلی
        } else {
            progressRing.style.stroke = 'var(--success-color)'; // رنگ سبز برای استراحت
        }

        timerInterval = setInterval(() => {
            currentSeconds--;
            updateDisplay();

            if (currentSeconds <= 0) {
                clearInterval(timerInterval);
                nextStage();
            }
        }, 1000);
    }

    function stopTimer() {
        isRunning = false;
        startBtn.textContent = 'ادامه';
        clearInterval(timerInterval);
    }

    function resetTimer() {
        stopTimer();
        pomoCount = 0;
        currentStage = 'POMODORO';
        totalSeconds = stages[currentStage];
        currentSeconds = totalSeconds;
        stageDisplay.textContent = 'آماده‌اید؟';
        startBtn.textContent = 'شروع';
        progressRing.style.stroke = 'var(--brand-color)';
        updateDisplay();
    }

    function nextStage() {
        if (currentStage === 'POMODORO') {
            pomoCount++;
            currentStage = (pomoCount % 4 === 0) ? 'LONG_BREAK' : 'SHORT_BREAK';
        } else {
            currentStage = 'POMODORO';
        }
        totalSeconds = stages[currentStage];
        currentSeconds = totalSeconds;
        updateDisplay();
        startTimer(); // شروع خودکار مرحله بعدی
    }

    startBtn.addEventListener('click', () => {
        if (isRunning) {
            stopTimer();
        } else {
            startTimer();
        }
    });

    resetBtn.addEventListener('click', resetTimer);
    
    // مقداردهی اولیه
    updateDisplay();
}