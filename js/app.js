/* ========================================
   来都来了 - 美食种草地图
   JavaScript 核心逻辑
   ======================================== */

// ============ 常量与配置 ============
const STORAGE_KEY = 'foodmap_shops';
const AMAP_KEY = 'f0715f44af28ca680306e944871af0dd'; // 高德地图 Key

// 暖色随机配色（用于店铺头像背景）
const AVATAR_COLORS = [
    '#FF8A3D', '#FF6B6B', '#FFA07A', '#FF7F50',
    '#E8723A', '#F4845F', '#FC5C65', '#FD7272',
    '#FF7979', '#FFB347', '#FF6348', '#FF5252',
    '#D35400', '#E74C3C', '#F39C12', '#E67E22'
];

// ============ 数据管理模块 ============
const DataStore = {
    /** 获取所有店铺 */
    getAll() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('读取数据失败:', e);
            return [];
        }
    },

    /** 保存所有店铺 */
    saveAll(shops) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(shops));
        } catch (e) {
            console.error('保存数据失败:', e);
            Toast.show('数据保存失败，可能存储空间不足');
        }
    },

    /** 添加店铺 */
    add(shop) {
        const shops = this.getAll();
        shop.id = this.generateId();
        shop.createdAt = new Date().toISOString();
        shop.visited = false;
        shop.visitedAt = null;
        shop.notes = [];
        // 如果有备注，加入 notes 数组
        if (shop.note && shop.note.trim()) {
            shop.notes.push({
                content: shop.note.trim(),
                time: this.formatDate(new Date())
            });
        }
        delete shop.note;
        shops.push(shop);
        this.saveAll(shops);
        return shop;
    },

    /** 更新店铺 */
    update(id, updates) {
        const shops = this.getAll();
        const index = shops.findIndex(s => s.id === id);
        if (index !== -1) {
            shops[index] = { ...shops[index], ...updates };
            this.saveAll(shops);
            return shops[index];
        }
        return null;
    },

    /** 删除店铺 */
    delete(id) {
        const shops = this.getAll();
        const filtered = shops.filter(s => s.id !== id);
        this.saveAll(filtered);
    },

    /** 获取单个店铺 */
    getById(id) {
        return this.getAll().find(s => s.id === id) || null;
    },

    /** 标记已拔草/取消拔草 */
    toggleVisited(id) {
        const shop = this.getById(id);
        if (!shop) return null;
        const visited = !shop.visited;
        return this.update(id, {
            visited,
            visitedAt: visited ? this.formatDate(new Date()) : null
        });
    },

    /** 添加备注 */
    addNote(id, content) {
        const shop = this.getById(id);
        if (!shop) return null;
        const notes = shop.notes || [];
        notes.push({
            content: content.trim(),
            time: this.formatDate(new Date())
        });
        return this.update(id, { notes });
    },

    /** 删除备注 */
    deleteNote(id, noteIndex) {
        const shop = this.getById(id);
        if (!shop) return null;
        const notes = (shop.notes || []).filter((_, i) => i !== noteIndex);
        return this.update(id, { notes });
    },

    /** 查询附近店铺（Haversine 公式） */
    findNearby(lng, lat, radiusKm) {
        const shops = this.getAll();
        const results = shops.map(shop => {
            const distance = this.haversine(lat, lng, shop.lat, shop.lng);
            return { ...shop, distance };
        }).filter(shop => shop.distance <= radiusKm)
          .sort((a, b) => a.distance - b.distance);
        return results;
    },

    /** Haversine 距离计算（单位：km） */
    haversine(lat1, lng1, lat2, lng2) {
        const R = 6371; // 地球半径 km
        const dLat = this.toRad(lat2 - lat1);
        const dLng = this.toRad(lng2 - lng1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
                  Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    },

    toRad(deg) {
        return deg * Math.PI / 180;
    },

    /** 生成唯一 ID */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    },

    /** 格式化日期 */
    formatDate(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    },

    /** 计算收藏天数 */
    getDaysSince(createdAt) {
        const created = new Date(createdAt);
        const now = new Date();
        const diff = now.getTime() - created.getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24));
    }
};

// ============ UI 工具模块 ============
const UI = {
    /** 生成店铺头像 HTML */
    avatarHTML(name, size) {
        size = size || 44;
        const firstChar = name ? name.charAt(0) : '?';
        const colorIndex = name ? name.charCodeAt(0) % AVATAR_COLORS.length : 0;
        const bgColor = AVATAR_COLORS[colorIndex];
        const fontSize = Math.round(size * 0.4);
        return `<div class="shop-avatar" style="width:${size}px;height:${size}px;background:${bgColor};font-size:${fontSize}px;">${firstChar}</div>`;
    },

    /** 格式化距离显示 */
    formatDistance(km) {
        if (km < 1) {
            return Math.round(km * 1000) + 'm';
        }
        return km.toFixed(1) + 'km';
    },

    /** 生成店铺卡片 HTML */
    shopCardHTML(shop, showDistance) {
        const days = DataStore.getDaysSince(shop.createdAt);
        const visitedClass = shop.visited ? 'visited' : 'unvisited';
        const visitedText = shop.visited ? '已拔草' : '未拔草';
        const latestNote = (shop.notes && shop.notes.length > 0)
            ? shop.notes[shop.notes.length - 1].content : '';
        const distanceHTML = showDistance
            ? `<div class="shop-distance">距离：${this.formatDistance(shop.distance)}</div>` : '';
        const noteHTML = latestNote
            ? `<div class="shop-note">${this.escapeHTML(latestNote)}</div>` : '';

        return `
            <div class="shop-card" data-id="${shop.id}">
                ${this.avatarHTML(shop.name)}
                <div class="shop-info">
                    <div class="shop-name">
                        ${this.escapeHTML(shop.name)}
                        <span class="visited-badge ${visitedClass}">${visitedText}</span>
                    </div>
                    ${distanceHTML}
                    <div class="shop-address">${this.escapeHTML(shop.address)}</div>
                    <div class="shop-meta">
                        <span>收藏${days}天</span>
                    </div>
                    ${noteHTML}
                </div>
            </div>`;
    },

    /** HTML 转义 */
    escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};

// ============ Toast 提示 ============
const Toast = {
    timer: null,
    show(message, duration) {
        duration = duration || 2000;
        const el = document.getElementById('toast');
        el.textContent = message;
        el.classList.add('show');
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => {
            el.classList.remove('show');
        }, duration);
    }
};

// ============ 确认弹窗 ============
const Confirm = {
    callback: null,
    show(message, onConfirm) {
        const modal = document.getElementById('confirm-modal');
        document.getElementById('confirm-message').textContent = message;
        modal.classList.remove('hidden');
        this.callback = onConfirm;
    },
    hide() {
        document.getElementById('confirm-modal').classList.add('hidden');
        this.callback = null;
    }
};

// ============ 页面导航 ============
const Router = {
    history: ['page-home'],

    /** 切换页面 */
    navigate(pageId) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const target = document.getElementById(pageId);
        if (target) {
            target.classList.add('active');
            this.history.push(pageId);
        }
    },

    /** 返回上一页 */
    back() {
        if (this.history.length > 1) {
            this.history.pop();
            const prevPage = this.history[this.history.length - 1];
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.getElementById(prevPage).classList.add('active');
        }
    }
};

// ============ 高德地图搜索模块 ============
const AmapSearch = {
    placeSearch: null,
    geocoder: null,
    amapReady: false,     // 高德 API 是否就绪
    pendingSearches: [],  // 等待 API 就绪的搜索请求

    /** 初始化：使用 AMapLoader 加载高德地图 */
    init() {
        if (typeof AMapLoader === 'undefined') {
            console.warn('AMapLoader 未加载，将使用模拟数据');
            return;
        }
        AMapLoader.load({
            key: AMAP_KEY,
            version: '2.0',
            plugins: ['AMap.PlaceSearch', 'AMap.Geocoder', 'AMap.Geolocation']
        }).then((AMap) => {
            // 全局暴露 AMap，供地图和定位使用
            window.AMap = AMap;
            this.placeSearch = new AMap.PlaceSearch({
                pageSize: 10,
                pageIndex: 1,
                city: '北京',
                citylimit: true
            });
            this.geocoder = new AMap.Geocoder({
                city: '北京'
            });
            this.amapReady = true;
            console.log('✅ 高德地图加载成功，搜索服务就绪');
            // 处理等待中的搜索请求
            this.pendingSearches.forEach(item => {
                if (item.type === 'poi') {
                    this.searchPOI(item.keyword, item.callback);
                } else if (item.type === 'geocode') {
                    this.geocode(item.address, item.callback);
                }
            });
            this.pendingSearches = [];
        }).catch((e) => {
            console.error('高德地图加载失败:', e);
        });
    },

    /** POI 搜索 */
    searchPOI(keyword, callback) {
        if (this.amapReady && this.placeSearch) {
            this._doPOISearch(keyword, callback);
            return;
        }
        // API 还没就绪，加入等待队列
        if (typeof AMapLoader !== 'undefined' && !this.amapReady) {
            console.log('⏳ 高德加载中，搜索请求排队等待...');
            this.pendingSearches.push({ type: 'poi', keyword, callback });
            return;
        }
        // AMapLoader 不可用，使用模拟数据
        console.warn('高德不可用，使用模拟搜索');
        this.mockSearch(keyword, callback);
    },

    /** 实际执行高德 POI 搜索 */
    _doPOISearch(keyword, callback) {
        console.log('🔍 调用高德 POI 搜索:', keyword);
        this.placeSearch.search(keyword, (status, result) => {
            console.log('POI搜索返回:', status, result);
            if (status === 'complete' && result.poiList && result.poiList.pois && result.poiList.pois.length > 0) {
                const pois = result.poiList.pois.map(poi => ({
                    name: poi.name,
                    address: poi.address || (poi.cityname || '') + (poi.adname || ''),
                    lng: poi.location ? poi.location.lng : 0,
                    lat: poi.location ? poi.location.lat : 0
                }));
                callback(null, pois);
            } else {
                console.warn('POI搜索无结果(status=' + status + ')，降级到模拟搜索');
                this.mockSearch(keyword, callback);
            }
        });
    },

    /** 地理编码（地点名 → 坐标） */
    geocode(address, callback) {
        if (this.amapReady && this.geocoder) {
            this._doGeocode(address, callback);
            return;
        }
        if (typeof AMapLoader !== 'undefined' && !this.amapReady) {
            console.log('⏳ 高德加载中，编码请求排队等待...');
            this.pendingSearches.push({ type: 'geocode', address, callback });
            return;
        }
        console.warn('高德不可用，使用模拟地理编码');
        this.mockGeocode(address, callback);
    },

    /** 实际执行高德地理编码 */
    _doGeocode(address, callback) {
        console.log('🔍 调用高德地理编码:', address);
        this.geocoder.getLocation(address, (status, result) => {
            console.log('地理编码返回:', status, result);
            if (status === 'complete' && result.geocodes && result.geocodes.length > 0) {
                const loc = result.geocodes[0].location;
                callback(null, {
                    lng: loc.lng,
                    lat: loc.lat,
                    address: result.geocodes[0].formattedAddress
                });
            } else {
                console.warn('地理编码失败(status=' + status + ')，降级到模拟');
                this.mockGeocode(address, callback);
            }
        });
    },

    /** 模拟搜索（降级方案） */
    mockSearch(keyword, callback) {
        const mockData = [
            { name: keyword + '(国贸店)', address: '北京市朝阳区建国门外大街1号', lng: 116.461447, lat: 39.908714 },
            { name: keyword + '(三里屯店)', address: '北京市朝阳区三里屯路19号', lng: 116.454348, lat: 39.933492 },
            { name: keyword + '(望京店)', address: '北京市朝阳区望京街9号', lng: 116.470689, lat: 39.995936 },
            { name: keyword + '(西单店)', address: '北京市西城区西单北大街120号', lng: 116.374341, lat: 39.913045 },
            { name: keyword + '(王府井店)', address: '北京市东城区王府井大街255号', lng: 116.417341, lat: 39.914949 }
        ];
        setTimeout(() => callback(null, mockData), 500);
    },

    /** 模拟地理编码 */
    mockGeocode(address, callback) {
        const mockLocations = {
            '三里屯': { lng: 116.454348, lat: 39.933492 },
            '国贸': { lng: 116.461447, lat: 39.908714 },
            '望京': { lng: 116.470689, lat: 39.995936 },
            '西单': { lng: 116.374341, lat: 39.913045 },
            '王府井': { lng: 116.417341, lat: 39.914949 },
            '中关村': { lng: 116.316833, lat: 39.983886 }
        };
        const loc = mockLocations[address] || { lng: 116.397428, lat: 39.90923 };
        setTimeout(() => callback(null, { ...loc, address: '北京市' + address }), 300);
    }
};

// ============ 定位模块 ============
const Location = {
    /** 获取当前定位 */
    getCurrent(callback) {
        // 优先使用高德定位
        if (typeof AMap !== 'undefined') {
            try {
                const geolocation = new AMap.Geolocation({
                    enableHighAccuracy: true,
                    timeout: 10000
                });
                geolocation.getCurrentPosition((status, result) => {
                    if (status === 'complete') {
                        callback(null, {
                            lng: result.position.lng,
                            lat: result.position.lat
                        });
                    } else {
                        console.warn('高德定位失败，降级浏览器定位');
                        this.browserLocate(callback);
                    }
                });
            } catch (e) {
                console.warn('高德定位异常，降级浏览器定位', e);
                this.browserLocate(callback);
            }
        } else {
            this.browserLocate(callback);
        }
    },

    /** 浏览器原生定位 */
    browserLocate(callback) {
        if (!navigator.geolocation) {
            callback(new Error('浏览器不支持定位'));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                callback(null, {
                    lng: pos.coords.longitude,
                    lat: pos.coords.latitude
                });
            },
            (err) => {
                callback(new Error('定位失败：' + err.message));
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    }
};

// ============ 地图展示模块 ============
const MapView = {
    map: null,
    markers: [],
    infoWindows: [],

    /** 初始化地图 */
    init(containerId, centerLng, centerLat) {
        // 清理旧地图
        if (this.map) {
            try { this.map.destroy(); } catch (e) { /* ignore */ }
            this.map = null;
        }
        this.markers = [];
        this.infoWindows = [];

        const container = document.getElementById(containerId);
        if (!container) return;

        if (typeof AMap === 'undefined') {
            container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#999;">地图加载中...请配置高德地图 Key</div>';
            return;
        }

        try {
            this.map = new AMap.Map(containerId, {
                zoom: 12,
                center: [centerLng || 116.397428, centerLat || 39.90923],
                resizeEnable: true
            });

            // 添加中心点标记（蓝色圆点表示搜索中心）
            if (centerLng && centerLat) {
                const centerMarker = new AMap.Marker({
                    position: [centerLng, centerLat],
                    content: '<div style="width:16px;height:16px;background:#1677ff;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>',
                    offset: new AMap.Pixel(-8, -8),
                    zIndex: 200
                });
                centerMarker.setMap(this.map);
            }
        } catch (e) {
            console.error('地图初始化失败:', e);
            container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#999;">地图加载失败</div>';
        }
    },

    /** 添加店铺标记 */
    addShopMarker(shop) {
        if (!this.map || typeof AMap === 'undefined') return;

        const colorIndex = shop.name ? shop.name.charCodeAt(0) % AVATAR_COLORS.length : 0;
        const bgColor = AVATAR_COLORS[colorIndex];
        const firstChar = shop.name ? shop.name.charAt(0) : '?';
        const days = DataStore.getDaysSince(shop.createdAt);
        const visitedText = shop.visited ? '✅ 已拔草' : '🌱 未拔草';

        const marker = new AMap.Marker({
            position: [shop.lng, shop.lat],
            content: `<div style="background:${bgColor};color:#fff;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);">${firstChar}</div>`,
            offset: new AMap.Pixel(-16, -16),
            zIndex: 100
        });

        // 点击标记打开信息窗
        marker.on('click', () => {
            // 先关闭其他信息窗
            this.infoWindows.forEach(iw => iw.close());
            
            const infoWindow = new AMap.InfoWindow({
                content: `<div style="padding:10px;min-width:200px;">
                    <div style="font-size:15px;font-weight:600;margin-bottom:6px;">${UI.escapeHTML(shop.name)}</div>
                    <div style="font-size:12px;color:#666;margin-bottom:3px;">📍 ${shop.distance !== undefined ? UI.formatDistance(shop.distance) : ''}</div>
                    <div style="font-size:12px;color:#666;margin-bottom:3px;">📅 收藏${days}天</div>
                    <div style="font-size:12px;color:#666;">${visitedText}</div>
                </div>`,
                offset: new AMap.Pixel(0, -20)
            });
            infoWindow.open(this.map, marker.getPosition());
            this.infoWindows.push(infoWindow);
        });

        marker.setMap(this.map);
        this.markers.push(marker);
    },

    /** 自适应视野 */
    fitView() {
        if (this.map && this.markers.length > 0) {
            try {
                this.map.setFitView(this.markers);
            } catch (e) {
                console.warn('fitView 失败:', e);
            }
        }
    }
};

// ============ 页面逻辑模块 ============
const Pages = {
    // ---- 当前附近搜索状态 ----
    nearbyCenter: null,  // { lng, lat }
    nearbyRadius: 10,    // km
    nearbyResults: [],
    currentView: 'list', // 'list' | 'map'

    // ---- 当前收藏筛选状态 ----
    collectionFilter: 'all', // 'all' | 'unvisited' | 'visited'

    // ---- 当前查看的店铺 ID ----
    currentShopId: null,
    previousPage: 'page-home',

    /** 初始化所有页面事件 */
    init() {
        this.initHomePage();
        this.initAddPage();
        this.initNearbyPage();
        this.initCollectionPage();
        this.initDetailPage();
        this.initEditPage();
        this.initGlobalEvents();
    },

    // ============ 首页 ============
    initHomePage() {
        document.getElementById('btn-add-food').addEventListener('click', () => {
            Router.navigate('page-add');
            this.resetAddForm();
        });

        document.getElementById('btn-nearby-food').addEventListener('click', () => {
            Router.navigate('page-nearby');
            this.resetNearbyPage();
        });

        document.getElementById('btn-my-collection').addEventListener('click', () => {
            Router.navigate('page-collection');
            this.renderCollectionList();
        });
    },

    // ============ 添加美食标记页 ============
    initAddPage() {
        const searchInput = document.getElementById('add-search-input');
        const searchBtn = document.getElementById('add-search-btn');
        const searchResults = document.getElementById('add-search-results');
        const nameInput = document.getElementById('add-name');
        const form = document.getElementById('add-food-form');

        // 搜索按钮
        searchBtn.addEventListener('click', () => {
            const keyword = searchInput.value.trim();
            if (!keyword) {
                Toast.show('请输入店铺名称');
                return;
            }
            searchResults.innerHTML = '<div class="loading">搜索中</div>';
            AmapSearch.searchPOI(keyword, (err, pois) => {
                if (err || !pois.length) {
                    searchResults.innerHTML = '<div class="empty-state"><p>未找到相关店铺</p></div>';
                    return;
                }
                searchResults.innerHTML = pois.map(poi => `
                    <div class="search-result-item" data-name="${UI.escapeHTML(poi.name)}" data-address="${UI.escapeHTML(poi.address)}" data-lng="${poi.lng}" data-lat="${poi.lat}">
                        <div class="result-name">${UI.escapeHTML(poi.name)}</div>
                        <div class="result-address">${UI.escapeHTML(poi.address)}</div>
                    </div>
                `).join('');
            });
        });

        // 回车搜索
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') searchBtn.click();
        });

        // 选择搜索结果
        searchResults.addEventListener('click', (e) => {
            const item = e.target.closest('.search-result-item');
            if (!item) return;
            nameInput.value = item.dataset.name;
            document.getElementById('add-address').value = item.dataset.address;
            document.getElementById('add-lng').value = item.dataset.lng;
            document.getElementById('add-lat').value = item.dataset.lat;
            searchResults.innerHTML = '';
            searchInput.value = '';
            this.updateAvatarPreview();
        });

        // 名称变化时更新头像预览
        nameInput.addEventListener('input', () => {
            this.updateAvatarPreview();
        });

        // 提交表单
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = nameInput.value.trim();
            const address = document.getElementById('add-address').value.trim();
            const lng = parseFloat(document.getElementById('add-lng').value) || 0;
            const lat = parseFloat(document.getElementById('add-lat').value) || 0;
            const note = document.getElementById('add-note').value.trim();

            if (!name) {
                Toast.show('请输入店铺名称');
                return;
            }
            if (!address) {
                Toast.show('请输入店铺地址');
                return;
            }

            DataStore.add({ name, address, lng, lat, note });
            Toast.show('种草成功！');
            this.resetAddForm();
            Router.back();
        });
    },

    /** 更新头像预览 */
    updateAvatarPreview() {
        const name = document.getElementById('add-name').value.trim();
        const preview = document.getElementById('add-avatar-preview');
        if (name) {
            const firstChar = name.charAt(0);
            const colorIndex = name.charCodeAt(0) % AVATAR_COLORS.length;
            preview.style.background = AVATAR_COLORS[colorIndex];
            preview.textContent = firstChar;
        } else {
            preview.style.background = 'var(--primary)';
            preview.textContent = '?';
        }
    },

    /** 重置添加表单 */
    resetAddForm() {
        document.getElementById('add-search-input').value = '';
        document.getElementById('add-search-results').innerHTML = '';
        document.getElementById('add-name').value = '';
        document.getElementById('add-address').value = '';
        document.getElementById('add-lng').value = '';
        document.getElementById('add-lat').value = '';
        document.getElementById('add-note').value = '';
        this.updateAvatarPreview();
    },

    // ============ 查询附近页 ============
    initNearbyPage() {
        const searchInput = document.getElementById('nearby-search-input');
        const searchBtn = document.getElementById('nearby-search-btn');
        const searchResults = document.getElementById('nearby-search-results');
        const locationBtn = document.getElementById('btn-current-location');

        // 搜索地点
        searchBtn.addEventListener('click', () => {
            const keyword = searchInput.value.trim();
            if (!keyword) {
                Toast.show('请输入地点');
                return;
            }
            searchResults.innerHTML = '<div class="loading">搜索中</div>';
            AmapSearch.geocode(keyword, (err, result) => {
                if (err) {
                    searchResults.innerHTML = '<div class="empty-state"><p>未找到该地点</p></div>';
                    return;
                }
                // 直接使用第一个结果
                this.nearbyCenter = { lng: result.lng, lat: result.lat };
                searchResults.innerHTML = '';
                searchInput.value = '';
                Toast.show('已定位到：' + result.address);
                this.searchNearby();
            });
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') searchBtn.click();
        });

        // 当前定位
        locationBtn.addEventListener('click', () => {
            Toast.show('正在获取定位...');
            Location.getCurrent((err, pos) => {
                if (err) {
                    Toast.show(err.message);
                    return;
                }
                this.nearbyCenter = pos;
                Toast.show('定位成功');
                this.searchNearby();
            });
        });

        // 搜索半径
        document.querySelectorAll('.radius-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.radius-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.nearbyRadius = parseInt(btn.dataset.radius);
                if (this.nearbyCenter) {
                    this.searchNearby();
                }
            });
        });

        // 视图切换
        document.querySelectorAll('#view-toggle .toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#view-toggle .toggle-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentView = btn.dataset.view;
                document.getElementById('nearby-list-view').classList.toggle('active', this.currentView === 'list');
                document.getElementById('nearby-map-view').classList.toggle('active', this.currentView === 'map');
                if (this.currentView === 'map' && this.nearbyCenter) {
                    this.renderNearbyMap();
                }
            });
        });

        // 点击店铺卡片
        document.getElementById('nearby-list').addEventListener('click', (e) => {
            const card = e.target.closest('.shop-card');
            if (card) {
                this.showDetail(card.dataset.id, 'page-nearby');
            }
        });
    },

    /** 重置附近页面 */
    resetNearbyPage() {
        this.nearbyCenter = null;
        this.nearbyResults = [];
        this.currentView = 'list';
        document.getElementById('nearby-search-input').value = '';
        document.getElementById('nearby-search-results').innerHTML = '';
        document.getElementById('nearby-list').innerHTML = '';
        document.getElementById('nearby-empty').classList.add('hidden');
        document.getElementById('nearby-list-view').classList.add('active');
        document.getElementById('nearby-map-view').classList.remove('active');
        document.querySelectorAll('#view-toggle .toggle-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.view === 'list');
        });
    },

    /** 执行附近搜索 */
    searchNearby() {
        if (!this.nearbyCenter) {
            Toast.show('请先选择地点或获取定位');
            return;
        }
        const results = DataStore.findNearby(
            this.nearbyCenter.lng,
            this.nearbyCenter.lat,
            this.nearbyRadius
        );
        this.nearbyResults = results;
        this.renderNearbyList();

        // 如果当前是地图视图，也更新地图
        if (this.currentView === 'map') {
            this.renderNearbyMap();
        }
    },

    /** 渲染附近列表 */
    renderNearbyList() {
        const listEl = document.getElementById('nearby-list');
        const emptyEl = document.getElementById('nearby-empty');

        if (this.nearbyResults.length === 0) {
            listEl.innerHTML = '';
            emptyEl.classList.remove('hidden');
            return;
        }

        emptyEl.classList.add('hidden');
        listEl.innerHTML = this.nearbyResults.map(shop => UI.shopCardHTML(shop, true)).join('');
    },

    /** 渲染附近地图 */
    renderNearbyMap() {
        if (!this.nearbyCenter) return;
        MapView.init('nearby-map', this.nearbyCenter.lng, this.nearbyCenter.lat);
        this.nearbyResults.forEach(shop => {
            MapView.addShopMarker(shop);
        });
        MapView.fitView();
    },

    // ============ 我的收藏页 ============
    initCollectionPage() {
        // 筛选按钮
        document.getElementById('btn-filter').addEventListener('click', () => {
            const bar = document.getElementById('filter-bar');
            bar.classList.toggle('hidden');
        });

        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.collectionFilter = btn.dataset.filter;
                this.renderCollectionList();
            });
        });

        // 搜索
        document.getElementById('collection-search-input').addEventListener('input', () => {
            this.renderCollectionList();
        });

        // 点击店铺卡片
        document.getElementById('collection-list').addEventListener('click', (e) => {
            const card = e.target.closest('.shop-card');
            if (card) {
                this.showDetail(card.dataset.id, 'page-collection');
            }
        });
    },

    /** 渲染收藏列表 */
    renderCollectionList() {
        let shops = DataStore.getAll();
        const emptyEl = document.getElementById('collection-empty');
        const listEl = document.getElementById('collection-list');
        const keyword = document.getElementById('collection-search-input').value.trim().toLowerCase();

        // 筛选
        if (this.collectionFilter === 'unvisited') {
            shops = shops.filter(s => !s.visited);
        } else if (this.collectionFilter === 'visited') {
            shops = shops.filter(s => s.visited);
        }

        // 搜索
        if (keyword) {
            shops = shops.filter(s =>
                s.name.toLowerCase().includes(keyword) ||
                s.address.toLowerCase().includes(keyword)
            );
        }

        if (shops.length === 0) {
            listEl.innerHTML = '';
            emptyEl.classList.remove('hidden');
            return;
        }

        emptyEl.classList.add('hidden');
        // 按收藏时间倒序
        shops.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        listEl.innerHTML = shops.map(shop => UI.shopCardHTML(shop, false)).join('');
    },

    // ============ 店铺详情页 ============
    initDetailPage() {
        // 返回
        document.getElementById('detail-back').addEventListener('click', () => {
            Router.back();
        });

        // 编辑
        document.getElementById('btn-edit-shop').addEventListener('click', () => {
            if (this.currentShopId) {
                this.showEditPage(this.currentShopId);
            }
        });
    },

    /** 显示店铺详情 */
    showDetail(id, fromPage) {
        const shop = DataStore.getById(id);
        if (!shop) {
            Toast.show('店铺不存在');
            return;
        }
        this.currentShopId = id;
        this.previousPage = fromPage || 'page-home';

        const days = DataStore.getDaysSince(shop.createdAt);
        const visitedText = shop.visited ? '已拔草 🎉' : '未拔草 🌱';
        const notesHTML = (shop.notes && shop.notes.length > 0)
            ? shop.notes.map(n => `
                <div class="detail-row">
                    <div class="detail-label">备注</div>
                    <div class="detail-value">${UI.escapeHTML(n.content)}<br><small style="color:var(--text-hint)">${n.time}</small></div>
                </div>
            `).join('')
            : '<div class="detail-row"><div class="detail-label">备注</div><div class="detail-value" style="color:var(--text-hint)">暂无备注</div></div>';

        const content = document.getElementById('detail-content');
        content.innerHTML = `
            <div class="detail-header">
                ${UI.avatarHTML(shop.name, 72).replace('shop-avatar', 'detail-avatar')}
                <div class="detail-name">${UI.escapeHTML(shop.name)}</div>
                <div class="detail-status">${visitedText}</div>
            </div>
            <div class="detail-body">
                <div class="detail-row">
                    <div class="detail-label">地址</div>
                    <div class="detail-value">${UI.escapeHTML(shop.address)}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">收藏时间</div>
                    <div class="detail-value">${DataStore.formatDate(new Date(shop.createdAt))}（${days}天前）</div>
                </div>
                ${shop.visitedAt ? `<div class="detail-row"><div class="detail-label">拔草时间</div><div class="detail-value">${shop.visitedAt}</div></div>` : ''}
                ${notesHTML}
            </div>
            <div class="detail-actions">
                <button class="btn-visit ${shop.visited ? 'mark-unvisited' : 'mark-visited'}" id="btn-toggle-visit">
                    ${shop.visited ? '取消拔草' : '已吃过！拔草 🎉'}
                </button>
            </div>
        `;

        // 绑定拔草按钮
        document.getElementById('btn-toggle-visit').addEventListener('click', () => {
            DataStore.toggleVisited(id);
            Toast.show(shop.visited ? '已取消拔草标记' : '拔草成功！');
            this.showDetail(id, this.previousPage);
        });

        Router.navigate('page-detail');
    },

    // ============ 编辑店铺页 ============
    initEditPage() {
        // 返回
        document.getElementById('edit-back').addEventListener('click', () => {
            Router.back();
        });

        // 提交
        document.getElementById('edit-food-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const id = document.getElementById('edit-id').value;
            const name = document.getElementById('edit-name').value.trim();
            const address = document.getElementById('edit-address').value.trim();
            const lng = parseFloat(document.getElementById('edit-lng').value) || 0;
            const lat = parseFloat(document.getElementById('edit-lat').value) || 0;
            const newNote = document.getElementById('edit-new-note').value.trim();

            if (!name || !address) {
                Toast.show('请填写店铺名称和地址');
                return;
            }

            const updates = { name, address, lng, lat };
            DataStore.update(id, updates);

            // 添加新备注
            if (newNote) {
                DataStore.addNote(id, newNote);
            }

            Toast.show('保存成功');
            Router.back();
        });

        // 删除
        document.getElementById('btn-delete-shop').addEventListener('click', () => {
            Confirm.show('确定删除这家店铺吗？删除后无法恢复。', () => {
                const id = document.getElementById('edit-id').value;
                DataStore.delete(id);
                Toast.show('已删除');
                // 返回首页
                Router.history = ['page-home'];
                document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
                document.getElementById('page-home').classList.add('active');
            });
        });
    },

    /** 显示编辑页面 */
    showEditPage(id) {
        const shop = DataStore.getById(id);
        if (!shop) return;

        document.getElementById('edit-id').value = shop.id;
        document.getElementById('edit-name').value = shop.name;
        document.getElementById('edit-address').value = shop.address;
        document.getElementById('edit-lng').value = shop.lng;
        document.getElementById('edit-lat').value = shop.lat;
        document.getElementById('edit-new-note').value = '';

        // 渲染备注列表
        this.renderEditNotes(shop);

        Router.navigate('page-edit');
    },

    /** 渲染编辑页备注列表 */
    renderEditNotes(shop) {
        const notesList = document.getElementById('edit-notes-list');
        if (!shop.notes || shop.notes.length === 0) {
            notesList.innerHTML = '<div style="color:var(--text-hint);font-size:13px;">暂无备注</div>';
            return;
        }
        notesList.innerHTML = shop.notes.map((note, index) => `
            <div class="note-item">
                <div class="note-content">${UI.escapeHTML(note.content)}</div>
                <div class="note-time">${note.time}</div>
                <button class="note-delete" data-index="${index}">删除</button>
            </div>
        `).join('');

        // 绑定删除备注
        notesList.querySelectorAll('.note-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                const noteIndex = parseInt(btn.dataset.index);
                const id = document.getElementById('edit-id').value;
                DataStore.deleteNote(id, noteIndex);
                const updatedShop = DataStore.getById(id);
                this.renderEditNotes(updatedShop);
                Toast.show('备注已删除');
            });
        });
    },

    // ============ 全局事件 ============
    initGlobalEvents() {
        // 返回按钮
        document.querySelectorAll('.btn-back[data-target]').forEach(btn => {
            btn.addEventListener('click', () => {
                Router.back();
            });
        });

        // 确认弹窗
        document.getElementById('confirm-ok').addEventListener('click', () => {
            if (Confirm.callback) Confirm.callback();
            Confirm.hide();
        });

        document.getElementById('confirm-cancel').addEventListener('click', () => {
            Confirm.hide();
        });

        document.getElementById('confirm-modal').querySelector('.modal-overlay').addEventListener('click', () => {
            Confirm.hide();
        });
    }
};

// ============ 应用启动 ============
document.addEventListener('DOMContentLoaded', () => {
    // 1. 先初始化页面事件（不依赖高德地图，确保页面导航正常）
    try {
        Pages.init();
        console.log('✅ 页面事件初始化完成');
    } catch (e) {
        console.error('页面事件初始化失败:', e);
    }

    // 2. 通过 AMapLoader 异步加载高德地图（不阻塞页面）
    try {
        AmapSearch.init();
    } catch (e) {
        console.error('高德地图初始化失败:', e);
    }

    console.log('🍜 来都来了 - 美食种草地图 已启动');
});