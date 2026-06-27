/**
 * 运行时配置文件
 * 部署时由CI/CD流水线注入实际值，禁止在前端代码中硬编码敏感信息
 */
(function () {
    'use strict';

    // 高德地图配置 - 部署时注入实际值
    var AMAP_CONFIG = {
        key: '',           // 高德地图 Key，部署时注入
        securityJsCode: '' // 高德地图安全密钥，部署时注入
    };

    // 注入安全密钥配置
    if (AMAP_CONFIG.securityJsCode && window._AMapSecurityConfig) {
        window._AMapSecurityConfig.securityJsCode = AMAP_CONFIG.securityJsCode;
    }

    // 暴露配置到全局
    window.APP_CONFIG = {
        AMAP_KEY: AMAP_CONFIG.key
    };
})();