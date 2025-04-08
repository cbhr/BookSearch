// 配置
const API_BASE_URL = '/api';

// 状态管理
const state = {
    authToken: localStorage.getItem('authToken'),
    currentUser: null,
    csrfToken: '',
    searchSessionId: null,
    isLoadingMore: false,
    hasMoreResults: true
};

// DOM元素缓存
const elements = {
    searchInput: document.getElementById('keyword'),
    searchBtn: document.getElementById('search'),
    resultsContainer: document.querySelector('.results-container'),
    resultsRow: document.getElementById('results-row'),
    loadingSpinner: document.getElementById('loading-spinner'),
    loadMoreSpinner: document.createElement('div')
};

// 初始化加载更多的指示器
elements.loadMoreSpinner.className = 'text-center my-4 d-none';
elements.loadMoreSpinner.innerHTML = '<div class="spinner-border text-primary"></div><p class="mt-2 text-muted">正在加载更多书籍...</p>';
elements.resultsContainer.appendChild(elements.loadMoreSpinner);

// 模态框实例
let modals = {
    loginModal: null,
    registerModal: null,
    downloadModal: null
};

// 工具函数
const utils = {
    validateEmail: (email) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },
    
    showLoading: () => {
        elements.loadingSpinner.classList.add('show');
    },
    
    hideLoading: () => {
        elements.loadingSpinner.classList.remove('show');
    },
    
    showLoadingMore: () => {
        elements.loadMoreSpinner.classList.remove('d-none');
    },
    
    hideLoadingMore: () => {
        elements.loadMoreSpinner.classList.add('d-none');
    },
    
    showNotification: (title, message, type = 'success') => {
        const notification = document.createElement('div');
        notification.className = `notification ${type} p-3 bg-white rounded shadow`;
        notification.innerHTML = `
            <div class="d-flex align-items-center mb-2">
                <i class="fas fa-${type === 'success' ? 'check' : 'exclamation'}-circle ${type === 'success' ? 'text-success' : 'text-danger'} me-2"></i>
                <strong>${title}</strong>
                <button type="button" class="btn-close ms-auto" onclick="this.parentElement.parentElement.remove()"></button>
            </div>
            <div>${message}</div>
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.classList.add('show'), 10);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    },
    
    isScrolledToBottom: () => {
        const scrollY = window.scrollY || window.pageYOffset;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        
        // 当滚动到距离底部150px时触发加载
        return documentHeight - (scrollY + windowHeight) < 150;
    }
};

// API请求函数
const api = {
    async request(endpoint, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        if (state.authToken) {
            defaultOptions.headers.Authorization = `Bearer ${state.authToken}`;
        }
        
        if (state.csrfToken && !['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(options.method)) {
            defaultOptions.headers['X-CSRFToken'] = state.csrfToken;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                ...defaultOptions,
                ...options
            });
            return await response.json();
        } catch (error) {
            console.error('API请求失败:', error);
            throw error;
        }
    },
    
    async checkAuth() {
        try {
            const res = await this.request('/check');
            if (res.csrf_token) {
                state.csrfToken = res.csrf_token;
            }
            return res;
        } catch (error) {
            console.error('验证登录状态失败:', error);
            return { is_authenticated: false };
        }
    },
    
    async login(email, password) {
        return await this.request('/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
    },
    
    async register(data) {
        return await this.request('/register', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    
    async sendVerificationCode(email) {
        return await this.request('/send-verification-code', {
            method: 'POST',
            body: JSON.stringify({ email })
        });
    },
    
    async search(keyword) {
        const response = await this.request('/search', {
            method: 'POST',
            body: JSON.stringify({ keyword })
        });
        
        // 如果后端在响应中包含会话ID，保存它以便加载更多结果
        if (response && response.session_id) {
            state.searchSessionId = response.session_id;
            state.hasMoreResults = true;
        } else {
            state.searchSessionId = null;
            state.hasMoreResults = false;
        }
        
        return response;
    },
    
    async loadMoreResults() {
        if (!state.searchSessionId) return [];
        
        try {
            const response = await this.request(`/search-more/${state.searchSessionId}`);
            
            // 如果返回空数组或结果少于预期数量，表示没有更多结果
            if (!response || !response.length || response.length === 0) {
                state.hasMoreResults = false;
            }
            
            return response;
        } catch (error) {
            console.error('加载更多结果失败:', error);
            state.hasMoreResults = false;
            return [];
        }
    },
    
    async download(data) {
        return await this.request('/download', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    
    async getCaptcha() {
        return await this.request('/captcha');
    }
};

// UI更新函数
const ui = {
    updateForLoggedInUser() {
        document.querySelector('.auth-buttons').classList.add('d-none');
        document.querySelector('.user-info').classList.remove('d-none');
        document.querySelector('.user-avatar').textContent = state.currentUser.username.charAt(0).toUpperCase();
        document.querySelector('.user-name').textContent = state.currentUser.username;
        document.querySelector('.vip-badge').textContent = `VIP${state.currentUser.vip_level}`;
    },
    
    updateForLoggedOutUser() {
        document.querySelector('.auth-buttons').classList.remove('d-none');
        document.querySelector('.user-info').classList.add('d-none');
    },
    
    renderSearchResults(books, append = false) {
        elements.resultsContainer.classList.remove('d-none');
        document.querySelector('.search-container').classList.add('results-shown');
        
        if (!books || books.length === 0) {
            if (!append) {
                elements.resultsRow.innerHTML = `
                    <div class="col-12 text-center py-5">
                        <h3 class="text-muted">没有找到相关书籍</h3>
                        <p class="text-muted">请尝试使用其他关键词搜索</p>
                    </div>
                `;
            }
            return;
        }
        
        const booksHtml = books.map(book => `
            <div class="col-md-4 col-lg-3 mb-4">
                <div class="book-card">
                    <div class="card-img-container">
                        <img src="${book.cover || 'img/default-cover.jpg'}" 
                             alt="${book.title}" 
                             onerror="this.src='img/default-cover.jpg'">
                    </div>
                    <div class="card-body">
                        <h5 class="book-title">${book.title}</h5>
                        <p class="text-muted mb-2">${book.author || '未知作者'}</p>
                        <div class="small text-muted mb-3">
                            <p class="mb-1">出版社: ${book.publisher || '未知'}</p>
                            <p class="mb-1">语言: ${book.language || '未知'}</p>
                            <p class="mb-1">年份: ${book.year || '未知'}</p>
                            <p class="mb-1">格式: ${book.extension || '未知'} (${book.filesizeString || '未知大小'})</p>
                        </div>
                        <button class="btn btn-primary w-100" 
                                onclick="app.showDownloadModal('${book.id}', '${book.hash}')"
                                data-id="${book.id}" 
                                data-hash="${book.hash}">
                            <i class="fas fa-download"></i> 发送至邮箱
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
        
        if (append) {
            elements.resultsRow.insertAdjacentHTML('beforeend', booksHtml);
        } else {
            elements.resultsRow.innerHTML = booksHtml;
        }
    },
    
    showNoMoreResults() {
        const noMoreResultsEl = document.createElement('div');
        noMoreResultsEl.className = 'col-12 text-center py-3 my-3';
        noMoreResultsEl.innerHTML = '<p class="text-muted">已加载全部结果</p>';
        elements.resultsRow.insertAdjacentElement('afterend', noMoreResultsEl);
    }
};

// 主应用逻辑
const app = {
    async init() {
        console.log('应用初始化...');
        
        // 初始化模态框
        this.initModals();
        
        // 检查登录状态
        if (state.authToken) {
            const res = await api.checkAuth();
            if (res.is_authenticated) {
                state.currentUser = {
                    username: res.username,
                    email: res.email,
                    vip_level: res.vip_level
                };
                ui.updateForLoggedInUser();
            } else {
                this.logout();
            }
        }
        
        // 绑定事件
        this.bindEvents();
    },
    
    initModals() {
        // 确保在DOM加载完成后初始化模态框
        const loginModalEl = document.getElementById('loginModal');
        const registerModalEl = document.getElementById('registerModal');
        const downloadModalEl = document.getElementById('emailModal');
        
        if (loginModalEl) {
            modals.loginModal = new bootstrap.Modal(loginModalEl);
            console.log('登录模态框初始化成功');
        } else {
            console.error('登录模态框元素未找到');
        }
        
        if (registerModalEl) {
            modals.registerModal = new bootstrap.Modal(registerModalEl);
            console.log('注册模态框初始化成功');
        } else {
            console.error('注册模态框元素未找到');
        }
        
        if (downloadModalEl) {
            modals.downloadModal = new bootstrap.Modal(downloadModalEl);
            console.log('下载模态框初始化成功');
        } else {
            console.error('下载模态框元素未找到');
        }
    },
    
    bindEvents() {
        // 搜索相关
        elements.searchBtn.addEventListener('click', () => this.handleSearch());
        elements.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSearch();
        });
        
        // 登录相关
        document.getElementById('btnLogin').addEventListener('click', () => {
            console.log('点击登录按钮');
            if (modals.loginModal) {
                modals.loginModal.show();
            } else {
                console.error('登录模态框实例不存在');
                // 尝试直接使用jQuery
                $('#loginModal').modal('show');
            }
        });
        document.getElementById('submitLogin').addEventListener('click', () => this.handleLogin());
        
        // 注册相关
        document.getElementById('btnRegister').addEventListener('click', () => {
            console.log('点击注册按钮');
            if (modals.registerModal) {
                modals.registerModal.show();
            } else {
                console.error('注册模态框实例不存在');
                // 尝试直接使用jQuery
                $('#registerModal').modal('show');
            }
        });
        document.getElementById('submitRegister').addEventListener('click', () => this.handleRegister());
        document.getElementById('getVerificationCode').addEventListener('click', () => this.handleGetVerificationCode());
        
        // 退出登录
        document.getElementById('btnLogout').addEventListener('click', () => this.logout());
        
        // 验证码刷新
        document.getElementById('captchaImage').addEventListener('click', () => this.refreshCaptcha());
        
        // 下载确认
        document.getElementById('downloadBtn').addEventListener('click', () => this.handleDownload());
        
        // 监听滚动事件，实现无限加载
        window.addEventListener('scroll', this.handleScroll.bind(this));
    },
    
    handleScroll() {
        // 如果已经在加载、没有更多结果或者搜索结果不可见，不执行加载操作
        if (state.isLoadingMore || !state.hasMoreResults || elements.resultsContainer.classList.contains('d-none')) {
            return;
        }
        
        // 如果已经滚动到底部，加载更多结果
        if (utils.isScrolledToBottom()) {
            this.loadMoreResults();
        }
    },
    
    async loadMoreResults() {
        if (!state.searchSessionId || state.isLoadingMore || !state.hasMoreResults) return;
        
        state.isLoadingMore = true;
        utils.showLoadingMore();
        
        try {
            const moreBooks = await api.loadMoreResults();
            
            utils.hideLoadingMore();
            
            if (moreBooks && moreBooks.length > 0) {
                ui.renderSearchResults(moreBooks, true);
            } else {
                state.hasMoreResults = false;
                ui.showNoMoreResults();
            }
        } catch (error) {
            utils.showNotification('错误', '加载更多书籍失败，请稍后重试', 'error');
            state.hasMoreResults = false;
        } finally {
            state.isLoadingMore = false;
            utils.hideLoadingMore();
        }
    },
    
    async handleSearch() {
        if (!state.authToken) {
            utils.showNotification('提示', '请先登录后再搜索书籍', 'error');
            if (modals.loginModal) {
                modals.loginModal.show();
            } else {
                $('#loginModal').modal('show');
            }
            return;
        }
        
        const keyword = elements.searchInput.value.trim();
        if (!keyword) {
            utils.showNotification('错误', '请输入搜索关键词', 'error');
            return;
        }
        
        // 重置加载状态
        state.searchSessionId = null;
        state.hasMoreResults = false;
        state.isLoadingMore = false;
        
        try {
            utils.showLoading();
            const results = await api.search(keyword);
            ui.renderSearchResults(results);
        } catch (error) {
            utils.showNotification('错误', '搜索失败，请稍后重试', 'error');
        } finally {
            utils.hideLoading();
        }
    },
    
    async handleLogin() {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const errorElement = document.getElementById('loginError');
        const submitBtn = document.getElementById('submitLogin');
        
        if (!email || !password) {
            errorElement.textContent = '请输入邮箱和密码';
            errorElement.classList.remove('d-none');
            return;
        }
        
        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 登录中...';
            
            const res = await api.login(email, password);
            if (res.status === 0) {
                state.authToken = res.token;
                state.currentUser = {
                    username: res.username,
                    email: res.email,
                    vip_level: res.vip_level
                };
                
                localStorage.setItem('authToken', res.token);
                if (modals.loginModal) {
                    modals.loginModal.hide();
                } else {
                    $('#loginModal').modal('hide');
                }
                
                document.getElementById('loginForm').reset();
                errorElement.classList.add('d-none');
                
                ui.updateForLoggedInUser();
                utils.showNotification('成功', '登录成功');
            } else {
                errorElement.textContent = res.message;
                errorElement.classList.remove('d-none');
            }
        } catch (error) {
            errorElement.textContent = '登录失败，请稍后重试';
            errorElement.classList.remove('d-none');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '登录';
        }
    },
    
    async handleRegister() {
        const email = document.getElementById('registerEmail').value;
        const username = document.getElementById('registerUsername').value;
        const password = document.getElementById('registerPassword').value;
        const verificationCode = document.getElementById('registerVerificationCode').value;
        const errorElement = document.getElementById('registerError');
        const submitBtn = document.getElementById('submitRegister');
        
        if (!email || !username || !password || !verificationCode) {
            errorElement.textContent = '请填写所有字段';
            errorElement.classList.remove('d-none');
            return;
        }
        
        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 注册中...';
            
            const res = await api.register({
                email,
                username,
                password,
                verification_code: verificationCode
            });
            
            if (res.status === 0) {
                state.authToken = res.token;
                state.currentUser = {
                    username: res.username,
                    email: res.email,
                    vip_level: res.vip_level
                };
                
                localStorage.setItem('authToken', res.token);
                if (modals.registerModal) {
                    modals.registerModal.hide();
                } else {
                    $('#registerModal').modal('hide');
                }
                
                document.getElementById('registerForm').reset();
                errorElement.classList.add('d-none');
                
                ui.updateForLoggedInUser();
                utils.showNotification('成功', '注册成功');
            } else {
                errorElement.textContent = res.message;
                errorElement.classList.remove('d-none');
            }
        } catch (error) {
            errorElement.textContent = '注册失败，请稍后重试';
            errorElement.classList.remove('d-none');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '注册';
        }
    },
    
    async handleGetVerificationCode() {
        const email = document.getElementById('registerEmail').value;
        const errorElement = document.getElementById('registerError');
        const btn = document.getElementById('getVerificationCode');
        
        if (!email) {
            errorElement.textContent = '请先输入邮箱地址';
            errorElement.classList.remove('d-none');
            return;
        }
        
        try {
            btn.disabled = true;
            btn.textContent = '发送中...';
            
            const res = await api.sendVerificationCode(email);
            if (res.status === 0) {
                utils.showNotification('成功', res.message);
                
                let countdown = 60;
                const timer = setInterval(() => {
                    btn.textContent = `${countdown}秒后重试`;
                    countdown--;
                    if (countdown < 0) {
                        clearInterval(timer);
                        btn.disabled = false;
                        btn.textContent = '获取验证码';
                    }
                }, 1000);
            } else {
                errorElement.textContent = res.message;
                errorElement.classList.remove('d-none');
                btn.disabled = false;
                btn.textContent = '获取验证码';
            }
        } catch (error) {
            errorElement.textContent = '发送验证码失败，请稍后重试';
            errorElement.classList.remove('d-none');
            btn.disabled = false;
            btn.textContent = '获取验证码';
        }
    },
    
    logout() {
        localStorage.removeItem('authToken');
        state.authToken = null;
        state.currentUser = null;
        ui.updateForLoggedOutUser();
        utils.showNotification('提示', '您已成功退出登录');
    },
    
    async refreshCaptcha() {
        try {
            const res = await api.getCaptcha();
            if (res.status === 0) {
                document.getElementById('captchaImage').src = res.image;
                document.getElementById('sessionKey').value = res.session_key;
            } else {
                utils.showNotification('错误', '获取验证码失败: ' + res.message, 'error');
            }
        } catch (error) {
            utils.showNotification('错误', '获取验证码失败', 'error');
        }
    },
    
    showDownloadModal(bookId, bookHash) {
        if (!state.authToken) {
            utils.showNotification('提示', '请先登录后再下载书籍', 'error');
            return;
        }
        
        document.getElementById('bookId').value = bookId;
        document.getElementById('bookHash').value = bookHash;
        document.getElementById('email').value = state.currentUser?.email || '';
        document.getElementById('captchaCode').value = '';
        
        this.refreshCaptcha();
        if (modals.downloadModal) {
            modals.downloadModal.show();
        } else {
            $('#emailModal').modal('show');
        }
    },
    
    async handleDownload() {
        const email = document.getElementById('email').value;
        const captchaCode = document.getElementById('captchaCode').value;
        const bookId = document.getElementById('bookId').value;
        const bookHash = document.getElementById('bookHash').value;
        const downloadBtn = document.getElementById('downloadBtn');
        
        if (!utils.validateEmail(email)) {
            utils.showNotification('错误', '请输入有效的邮箱地址', 'error');
            return;
        }
        
        if (!captchaCode) {
            utils.showNotification('错误', '请输入验证码', 'error');
            return;
        }
        
        try {
            downloadBtn.disabled = true;
            downloadBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 处理中...';
            
            const res = await api.download({
                id: bookId,
                hash: bookHash,
                email: email,
                captcha_code: captchaCode
            });
            
            if (res.status === 0) {
                if (modals.downloadModal) {
                    modals.downloadModal.hide();
                } else {
                    $('#emailModal').modal('hide');
                }
                
                // 更新下载按钮状态
                const btn = document.querySelector(`[data-id="${bookId}"]`);
                if (btn) {
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-check"></i> 已发送';
                }
                
                utils.showNotification('成功', '下载链接已发送至您的邮箱，请查收！<br>如未收到请检查垃圾邮件。');
            } else {
                utils.showNotification('错误', res.error || '下载请求失败', 'error');
                this.refreshCaptcha();
            }
        } catch (error) {
            utils.showNotification('错误', '下载请求失败', 'error');
            this.refreshCaptcha();
        } finally {
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = '确认下载';
        }
    }
};

// 初始化应用
document.addEventListener('DOMContentLoaded', () => app.init()); 