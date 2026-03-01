/**
 * Layout engine – drag, resize, snap vs freeform, persist. Stub for deferred plugins.
 */
(function () {
    'use strict';

    var STATE = window.ArcaneDashboardState;
    if (!STATE) return;

    var GRID = 16;
    var container = null;
    var snapEnabled = true;
    var onLayoutChange = null;

    /** Placeholder for future plugin-loaded widgets. Register widget types here. */
    var pluginWidgetTypes = [];
    function registerPlugin(id, config) {
        pluginWidgetTypes.push({ id: id, config: config });
    }
    function loadPlugins() {
        return pluginWidgetTypes.slice();
    }

    function snap(value) {
        if (!snapEnabled) return value;
        return Math.round(value / GRID) * GRID;
    }

    function getWidgetElement(widgetId) {
        return container ? container.querySelector('[data-widget-id="' + widgetId + '"]') : null;
    }

    function makeWidgetElement(widget) {
        var el = document.createElement('div');
        el.className = 'ad-widget';
        el.dataset.widgetId = widget.id;
        el.style.left = (widget.x || 0) + 'px';
        el.style.top = (widget.y || 0) + 'px';
        el.style.width = (widget.w || 280) + 'px';
        el.style.height = (widget.h || 200) + 'px';

        var titleBar = document.createElement('div');
        titleBar.className = 'ad-widget-title-bar';
        titleBar.setAttribute('data-drag-handle', 'true');
        var title = document.createElement('span');
        title.className = 'ad-widget-title';
        title.textContent = widget.title || widget.type || 'Widget';
        titleBar.appendChild(title);

        var actions = document.createElement('div');
        actions.className = 'ad-widget-actions';
        var pinBtn = document.createElement('button');
        pinBtn.type = 'button';
        pinBtn.className = 'ad-widget-btn' + (widget.pinned ? ' pinned' : '');
        pinBtn.title = 'Visible in whisper mode';
        pinBtn.textContent = '\u26cf';
        pinBtn.setAttribute('data-action', 'pin');
        var hideBtn = document.createElement('button');
        hideBtn.type = 'button';
        hideBtn.className = 'ad-widget-btn';
        hideBtn.title = 'Hide';
        hideBtn.textContent = '\u2715';
        hideBtn.setAttribute('data-action', 'hide');
        actions.appendChild(pinBtn);
        actions.appendChild(hideBtn);
        titleBar.appendChild(actions);
        el.appendChild(titleBar);

        var body = document.createElement('div');
        body.className = 'ad-widget-body';
        body.setAttribute('data-widget-body', 'true');
        el.appendChild(body);

        var resizeHandle = document.createElement('div');
        resizeHandle.className = 'ad-resize-handle';
        resizeHandle.setAttribute('data-resize-handle', 'true');
        el.appendChild(resizeHandle);

        return { el: el, body: body, pinBtn: pinBtn, hideBtn: hideBtn };
    }

    function applyDragResize(el, widget, campaignId) {
        var titleBar = el.querySelector('[data-drag-handle="true"]');
        var resizeHandle = el.querySelector('[data-resize-handle="true"]');
        if (!titleBar || !resizeHandle) return;

        var startX, startY, startLeft, startTop, startW, startH;
        var isDrag = false;
        var isResize = false;

        function commit() {
            widget.x = parseInt(el.style.left, 10) || 0;
            widget.y = parseInt(el.style.top, 10) || 0;
            widget.w = parseInt(el.style.width, 10) || 280;
            widget.h = parseInt(el.style.height, 10) || 200;
            if (onLayoutChange) onLayoutChange(campaignId);
        }

        function onPointerDown(e) {
            if (e.target.closest('[data-resize-handle="true"]')) {
                isResize = true;
                startX = e.clientX;
                startY = e.clientY;
                startW = parseInt(el.style.width, 10);
                startH = parseInt(el.style.height, 10);
                e.preventDefault();
            } else if (e.target.closest('[data-drag-handle="true"]')) {
                isDrag = true;
                startX = e.clientX;
                startY = e.clientY;
                startLeft = parseInt(el.style.left, 10) || 0;
                startTop = parseInt(el.style.top, 10) || 0;
                e.preventDefault();
            }
        }

        function onPointerMove(e) {
            if (isResize) {
                var dw = e.clientX - startX;
                var dh = e.clientY - startY;
                var newW = Math.max(200, startW + dw);
                var newH = Math.max(100, startH + dh);
                el.style.width = (snapEnabled ? snap(newW) : newW) + 'px';
                el.style.height = (snapEnabled ? snap(newH) : newH) + 'px';
            } else if (isDrag) {
                var dx = e.clientX - startX;
                var dy = e.clientY - startY;
                var newLeft = startLeft + dx;
                var newTop = startTop + dy;
                el.style.left = (snapEnabled ? snap(newLeft) : Math.max(0, newLeft)) + 'px';
                el.style.top = (snapEnabled ? snap(newTop) : Math.max(0, newTop)) + 'px';
            }
        }

        function onPointerUp() {
            if (isDrag || isResize) commit();
            isDrag = false;
            isResize = false;
            document.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerup', onPointerUp);
        }

        el.addEventListener('pointerdown', function (e) {
            onPointerDown(e);
            if (isDrag || isResize) {
                document.addEventListener('pointermove', onPointerMove);
                document.addEventListener('pointerup', onPointerUp);
            }
        });
    }

    function render(layout, campaignId, widgetBodyRenderer) {
        if (!container) return;
        container.innerHTML = '';
        var widgets = layout.widgets || [];
        widgets.forEach(function (widget) {
            var built = makeWidgetElement(widget);
        if (widget.visible === false) built.el.classList.add('hidden');
        container.appendChild(built.el);
        applyDragResize(built.el, widget, campaignId);
            if (widgetBodyRenderer && typeof widgetBodyRenderer[widget.type] === 'function') {
                widgetBodyRenderer[widget.type](built.body, widget, campaignId);
            }
            built.pinBtn.addEventListener('click', function () {
                widget.pinned = !widget.pinned;
                built.pinBtn.classList.toggle('pinned', widget.pinned);
                if (onLayoutChange) onLayoutChange(campaignId);
            });
            built.hideBtn.addEventListener('click', function () {
                widget.visible = false;
                built.el.classList.add('hidden');
                if (onLayoutChange) onLayoutChange(campaignId);
            });
        });
    }

    function setSnapEnabled(enabled) {
        snapEnabled = !!enabled;
    }

    function setContainer(el) {
        container = el;
    }

    function setOnLayoutChange(fn) {
        onLayoutChange = fn;
    }

    window.ArcaneDashboardLayout = {
        setContainer: setContainer,
        setSnapEnabled: setSnapEnabled,
        setOnLayoutChange: setOnLayoutChange,
        render: render,
        getWidgetElement: getWidgetElement,
        GRID: GRID,
        registerPlugin: registerPlugin,
        loadPlugins: loadPlugins
    };
})();
