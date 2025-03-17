// 配置
const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:8080/api' : 
                     (window.location.hostname === 'book.godmap.site' ? '/api' : '/api');

// 状态管理
const state = {
    authToken: localStorage.getItem('authToken'),
    currentUser: null,
    csrfToken: ''
};

// DOM元素缓存
const elements = {
    searchInput: document.getElementById('keyword'),
    searchBtn: document.getElementById('search'),
    resultsContainer: document.querySelector('.results-container'),
    resultsRow: document.getElementById('results-row'),
    loadingSpinner: document.getElementById('loading-spinner')
};

// 模态框实例
let modals = {
    loginModal: null,
    registerModal: null,
    downloadModal: null,
    forgotPasswordModal: null,
    resetPasswordModal: null
};

// 验证码会话密钥
const sessionKeys = {
    login: '',
    register: '',
    download: '',
    forgotPassword: '',
    resetPassword: ''
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
    
    async login(data) {
        return await this.request('/login', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    
    async register(data) {
        return await this.request('/register', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    
    async sendVerificationCode(data) {
        return await this.request('/send-verification-code', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    
    async search(keyword) {
        return await this.request('/search', {
            method: 'POST',
            body: JSON.stringify({ keyword })
        });
    },
    
    async download(data) {
        return await this.request('/download', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    
    async getCaptcha(type = 'download') {
        return await this.request('/captcha');
    },
    
    async forgotPassword(data) {
        return await this.request('/send-password-reset-code', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    
    async verifyResetPassword(data) {
        return await this.request('/verify-password-reset-code', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    
    async resetPassword(data) {
        return await this.request('/reset-password', {
            method: 'POST',
            body: JSON.stringify(data)
        });
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
    
    renderSearchResults(books) {
        elements.resultsContainer.classList.remove('d-none');
        document.querySelector('.search-container').classList.add('results-shown');
        
        if (!books || books.length === 0) {
            elements.resultsRow.innerHTML = `
                <div class="col-12 text-center py-5">
                    <h3 class="text-muted">没有找到相关书籍</h3>
                    <p class="text-muted">请尝试使用其他关键词搜索</p>
                </div>
            `;
            return;
        }
        
        elements.resultsRow.innerHTML = books.map(book => `
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
                                onclick="app.showDownloadModal('${book.unique_id}')"
                                data-id="${book.id}" 
                                data-unique-id="${book.unique_id}">
                            <i class="fas fa-download"></i> 发送至邮箱
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
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
        try {
            // 尝试使用 Bootstrap 5 Modal API
            if (typeof bootstrap !== 'undefined') {
                const loginModalEl = document.getElementById('loginModal');
                const registerModalEl = document.getElementById('registerModal');
                const downloadModalEl = document.getElementById('emailModal');
                const forgotPasswordModalEl = document.getElementById('forgotPasswordModal');
                const resetPasswordModalEl = document.getElementById('resetPasswordModal');
                
                if (loginModalEl) {
                    modals.loginModal = new bootstrap.Modal(loginModalEl);
                    console.log('登录模态框初始化成功 (Bootstrap 5)');
                }
                
                if (registerModalEl) {
                    modals.registerModal = new bootstrap.Modal(registerModalEl);
                    console.log('注册模态框初始化成功 (Bootstrap 5)');
                }
                
                if (downloadModalEl) {
                    modals.downloadModal = new bootstrap.Modal(downloadModalEl);
                    console.log('下载模态框初始化成功 (Bootstrap 5)');
                }
                
                if (forgotPasswordModalEl) {
                    modals.forgotPasswordModal = new bootstrap.Modal(forgotPasswordModalEl);
                    console.log('忘记密码模态框初始化成功 (Bootstrap 5)');
                }
                
                if (resetPasswordModalEl) {
                    modals.resetPasswordModal = new bootstrap.Modal(resetPasswordModalEl);
                    console.log('重置密码模态框初始化成功 (Bootstrap 5)');
                }
            } else if (typeof $ !== 'undefined' && typeof $.fn.modal !== 'undefined') {
                // 回退到 Bootstrap 4 (jQuery) 方式
                console.log('使用 jQuery 初始化模态框 (Bootstrap 4)');
                $('#loginModal').modal({show: false});
                $('#registerModal').modal({show: false});
                $('#emailModal').modal({show: false});
                $('#forgotPasswordModal').modal({show: false});
                $('#resetPasswordModal').modal({show: false});
                
                // 创建兼容的接口
                modals.loginModal = { 
                    show: () => $('#loginModal').modal('show'),
                    hide: () => $('#loginModal').modal('hide')
                };
                
                modals.registerModal = { 
                    show: () => $('#registerModal').modal('show'),
                    hide: () => $('#registerModal').modal('hide')
                };
                
                modals.downloadModal = { 
                    show: () => $('#emailModal').modal('show'),
                    hide: () => $('#emailModal').modal('hide')
                };
                
                modals.forgotPasswordModal = {
                    show: () => $('#forgotPasswordModal').modal('show'),
                    hide: () => $('#forgotPasswordModal').modal('hide')
                };
                
                modals.resetPasswordModal = {
                    show: () => $('#resetPasswordModal').modal('show'),
                    hide: () => $('#resetPasswordModal').modal('hide')
                };
            } else {
                console.warn('未能找到 Bootstrap Modal API，模态框可能无法正常工作');
            }
        } catch (error) {
            console.error('初始化模态框失败:', error);
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
            this.refreshCaptcha('login').then(() => {
                if (modals.loginModal) {
                    modals.loginModal.show();
                } else {
                    $('#loginModal').modal('show');
                }
            });
        });
        document.getElementById('submitLogin').addEventListener('click', () => this.handleLogin());
        
        // 注册相关
        document.getElementById('btnRegister').addEventListener('click', () => {
            this.refreshCaptcha('register').then(() => {
                if (modals.registerModal) {
                    modals.registerModal.show();
                } else {
                    $('#registerModal').modal('show');
                }
            });
        });
        document.getElementById('submitRegister').addEventListener('click', () => this.handleRegister());
        document.getElementById('getVerificationCode').addEventListener('click', () => this.handleGetVerificationCode());
        
        // 忘记密码相关
        document.getElementById('forgotPasswordLink').addEventListener('click', (e) => {
            e.preventDefault();
            if (modals.loginModal) {
                modals.loginModal.hide();
            } else {
                $('#loginModal').modal('hide');
            }
            this.refreshCaptcha('forgotPassword').then(() => {
                if (modals.forgotPasswordModal) {
                    modals.forgotPasswordModal.show();
                } else {
                    $('#forgotPasswordModal').modal('show');
                }
            });
        });
        document.getElementById('submitForgotPassword').addEventListener('click', () => this.handleForgotPassword());
        
        // 验证码刷新
        document.getElementById('loginCaptchaImage').addEventListener('click', () => this.refreshCaptcha('login'));
        document.getElementById('registerCaptchaImage').addEventListener('click', () => this.refreshCaptcha('register'));
        document.getElementById('captchaImage').addEventListener('click', () => this.refreshCaptcha('download'));
        document.getElementById('forgotPasswordCaptchaImage').addEventListener('click', () => this.refreshCaptcha('forgotPassword'));
        document.getElementById('resetPasswordCaptchaImage').addEventListener('click', () => this.refreshCaptcha('resetPassword'));
        
        // 退出登录
        document.getElementById('btnLogout').addEventListener('click', () => this.logout());
        
        // 下载确认
        document.getElementById('downloadBtn').addEventListener('click', () => this.handleDownload());
        document.getElementById('submitResetPassword').addEventListener('click', () => this.handleResetPassword());
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
        const captchaCode = document.getElementById('loginCaptchaCode').value;
        const errorElement = document.getElementById('loginError');
        const submitBtn = document.getElementById('submitLogin');
        
        if (!email || !password || !captchaCode) {
            errorElement.textContent = '请填写所有字段';
            errorElement.classList.remove('d-none');
            return;
        }
        
        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 登录中...';
            
            const res = await api.login({
                email,
                password,
                captcha_code: captchaCode,
                session_key: sessionKeys.login
            });
            
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
                await this.refreshCaptcha('login');
            }
        } catch (error) {
            errorElement.textContent = '登录失败，请稍后重试';
            errorElement.classList.remove('d-none');
            await this.refreshCaptcha('login');
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
        const captchaCode = document.getElementById('registerCaptchaCode').value;
        const errorElement = document.getElementById('registerError');
        const submitBtn = document.getElementById('submitRegister');
        
        if (!email || !username || !password || !verificationCode || !captchaCode) {
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
                verification_code: verificationCode,
                captcha_code: captchaCode,
                session_key: sessionKeys.register
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
                await this.refreshCaptcha('register');
            }
        } catch (error) {
            errorElement.textContent = '注册失败，请稍后重试';
            errorElement.classList.remove('d-none');
            await this.refreshCaptcha('register');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '注册';
        }
    },
    
    async handleGetVerificationCode() {
        const email = document.getElementById('registerEmail').value;
        const captchaCode = document.getElementById('registerCaptchaCode').value;
        const errorElement = document.getElementById('registerError');
        const btn = document.getElementById('getVerificationCode');
        
        if (!email) {
            errorElement.textContent = '请先输入邮箱地址';
            errorElement.classList.remove('d-none');
            return;
        }
        
        if (!captchaCode) {
            errorElement.textContent = '请输入图形验证码';
            errorElement.classList.remove('d-none');
            return;
        }
        
        try {
            btn.disabled = true;
            btn.textContent = '发送中...';
            
            const res = await api.sendVerificationCode({
                email,
                captcha_code: captchaCode,
                session_key: sessionKeys.register
            });
            
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
                await this.refreshCaptcha('register');
            }
        } catch (error) {
            errorElement.textContent = '发送验证码失败，请稍后重试';
            errorElement.classList.remove('d-none');
            btn.disabled = false;
            btn.textContent = '获取验证码';
            await this.refreshCaptcha('register');
        }
    },
    
    logout() {
        localStorage.removeItem('authToken');
        state.authToken = null;
        state.currentUser = null;
        ui.updateForLoggedOutUser();
        utils.showNotification('提示', '您已成功退出登录');
    },
    
    async refreshCaptcha(type = 'download') {
        try {
            const res = await api.getCaptcha();
            if (res.status === 0) {
                // 保存会话密钥
                sessionKeys[type] = res.session_key;
                
                // 更新验证码图片
                const captchaImageId = type === 'download' ? 'captchaImage' : 
                                      `${type}CaptchaImage`;
                const captchaImage = document.getElementById(captchaImageId);
                
                if (captchaImage) {
                    captchaImage.src = res.image;
                }
                
                return res;
            } else {
                utils.showNotification('错误', '获取验证码失败: ' + res.message, 'error');
                throw new Error(res.message);
            }
        } catch (error) {
            utils.showNotification('错误', '获取验证码失败', 'error');
            throw error;
        }
    },
    
    showDownloadModal(uniqueId) {
        if (!state.authToken) {
            utils.showNotification('提示', '请先登录后再下载书籍', 'error');
            this.refreshCaptcha('login').then(() => {
                if (modals.loginModal) {
                    modals.loginModal.show();
                } else {
                    $('#loginModal').modal('show');
                }
            });
            return;
        }
        
        document.getElementById('bookUniqueId').value = uniqueId;
        document.getElementById('captchaCode').value = '';
        
        this.refreshCaptcha('download').then(() => {
            try {
                // 尝试使用 Bootstrap 5 方式
                if (modals.downloadModal) {
                    modals.downloadModal.show();
                } else {
                    // 降级到 jQuery 方式
                    $('#emailModal').modal('show');
                }
            } catch (error) {
                console.error('显示模态框失败:', error);
                // 最后尝试直接修改样式
                const modal = document.getElementById('emailModal');
                if (modal) {
                    modal.style.display = 'block';
                    modal.classList.add('show');
                    document.body.classList.add('modal-open');
                }
            }
        }).catch(error => {
            console.error('刷新验证码失败:', error);
            utils.showNotification('错误', '获取验证码失败，请刷新页面重试', 'error');
        });
    },
    
    async handleDownload() {
        const captchaCode = document.getElementById('captchaCode').value;
        const uniqueId = document.getElementById('bookUniqueId').value;
        const downloadBtn = document.getElementById('downloadBtn');
        
        if (!captchaCode) {
            utils.showNotification('错误', '请输入验证码', 'error');
            return;
        }
        
        try {
            downloadBtn.disabled = true;
            downloadBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 处理中...';
            
            const res = await api.download({
                unique_id: uniqueId,
                captcha_code: captchaCode,
                session_key: sessionKeys.download
            });
            
            if (res.status === 0) {
                if (modals.downloadModal) {
                    modals.downloadModal.hide();
                } else {
                    $('#emailModal').modal('hide');
                }
                
                // 更新下载按钮状态
                const btn = document.querySelector(`[data-unique-id="${uniqueId}"]`);
                if (btn) {
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-check"></i> 已发送';
                }
                
                utils.showNotification('成功', '下载链接已发送至您的邮箱，请查收！<br>如未收到请检查垃圾邮件。');
            } else {
                utils.showNotification('错误', res.error || '下载请求失败', 'error');
                await this.refreshCaptcha('download');
            }
        } catch (error) {
            utils.showNotification('错误', '下载请求失败', 'error');
            await this.refreshCaptcha('download');
        } finally {
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = '确认下载';
        }
    },
    
    async handleForgotPassword() {
        const email = document.getElementById('forgotPasswordEmail').value;
        const captchaCode = document.getElementById('forgotPasswordCaptchaCode').value;
        const errorElement = document.getElementById('forgotPasswordError');
        const successElement = document.getElementById('forgotPasswordSuccess');
        const submitBtn = document.getElementById('submitForgotPassword');
        
        if (!email || !captchaCode) {
            errorElement.textContent = '请填写所有字段';
            errorElement.classList.remove('d-none');
            successElement.classList.add('d-none');
            return;
        }
        
        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 发送中...';
            
            const res = await api.forgotPassword({
                email,
                captcha_code: captchaCode,
                session_key: sessionKeys.forgotPassword
            });
            
            if (res.status === 0) {
                errorElement.classList.add('d-none');
                successElement.textContent = '重置密码验证码已发送到您的邮箱，请查收';
                successElement.classList.remove('d-none');
                // 3秒后提示用户进入重置密码页面
                setTimeout(() => {
                    if (modals.forgotPasswordModal) {
                        modals.forgotPasswordModal.hide();
                    } else {
                        $('#forgotPasswordModal').modal('hide');
                    }
                    
                    // 弹出重置密码模态框
                    this.refreshCaptcha('resetPassword').then(() => {
                        // 设置当前要重置密码的邮箱
                        const resetForm = document.getElementById('resetPasswordForm');
                        if (resetForm) {
                            const emailInput = document.createElement('input');
                            emailInput.type = 'hidden';
                            emailInput.id = 'resetEmail';
                            emailInput.value = email;
                            resetForm.appendChild(emailInput);
                        }
                        
                        if (modals.resetPasswordModal) {
                            modals.resetPasswordModal.show();
                        } else {
                            $('#resetPasswordModal').modal('show');
                        }
                    });
                }, 2000);
            } else {
                errorElement.textContent = res.message;
                errorElement.classList.remove('d-none');
                successElement.classList.add('d-none');
                await this.refreshCaptcha('forgotPassword');
            }
        } catch (error) {
            errorElement.textContent = '发送重置验证码失败，请稍后重试';
            errorElement.classList.remove('d-none');
            successElement.classList.add('d-none');
            await this.refreshCaptcha('forgotPassword');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '发送重置验证码';
        }
    },
    
    async handleResetPassword() {
        const email = document.getElementById('resetEmail')?.value;
        const password = document.getElementById('resetPassword').value;
        const passwordConfirm = document.getElementById('resetPasswordConfirm').value;
        const captchaCode = document.getElementById('resetPasswordCaptchaCode').value;
        const verificationCode = document.getElementById('resetVerificationCode').value;
        const errorElement = document.getElementById('resetPasswordError');
        const submitBtn = document.getElementById('submitResetPassword');
        
        if (!email || !password || !passwordConfirm || !verificationCode || !captchaCode) {
            errorElement.textContent = '请填写所有字段';
            errorElement.classList.remove('d-none');
            return;
        }
        
        if (password !== passwordConfirm) {
            errorElement.textContent = '两次输入的密码不一致';
            errorElement.classList.remove('d-none');
            return;
        }
        
        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 重置中...';
            
            const res = await api.verifyResetPassword({
                email,
                verification_code: verificationCode,
                new_password: password,
                captcha_code: captchaCode,
                session_key: sessionKeys.resetPassword
            });
            
            if (res.status === 0) {
                utils.showNotification('成功', '密码重置成功，请使用新密码登录');
                
                if (modals.resetPasswordModal) {
                    modals.resetPasswordModal.hide();
                } else {
                    $('#resetPasswordModal').modal('hide');
                }
                
                // 清除所有表单
                document.getElementById('forgotPasswordForm')?.reset();
                document.getElementById('resetPasswordForm')?.reset();
                
                // 显示登录模态框
                setTimeout(() => {
                    this.refreshCaptcha('login').then(() => {
                        if (modals.loginModal) {
                            modals.loginModal.show();
                        } else {
                            $('#loginModal').modal('show');
                        }
                    });
                }, 1000);
            } else {
                errorElement.textContent = res.message;
                errorElement.classList.remove('d-none');
                await this.refreshCaptcha('resetPassword');
            }
        } catch (error) {
            errorElement.textContent = '重置密码失败，请稍后重试';
            errorElement.classList.remove('d-none');
            await this.refreshCaptcha('resetPassword');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '重置密码';
        }
    }
};

// 初始化应用
document.addEventListener('DOMContentLoaded', () => app.init()); 