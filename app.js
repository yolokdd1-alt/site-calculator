(() => {
  'use strict';
  const config = window.CALCULATOR_CONFIG;
  const cleanUrl = new URL(location.href);
  if (cleanUrl.searchParams.has('estimate')) {
    cleanUrl.searchParams.delete('estimate');
    history.replaceState(null, '', cleanUrl);
  }
  const $ = (selector) => document.querySelector(selector);
  const allOptions = config.groups.flatMap(group => group.options);
  const storageKey = 'site-estimate-v2';
  const rub = value => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: config.currency, maximumFractionDigits: 0 }).format(value);
  const priced = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  const unitPrice = value => priced(value) ? rub(value) : 'Цена уточняется';
  const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
  const defaults = () => ({ package: config.packages[0].id, quantities: {}, options: [], custom: [], comment: '' });
  let state = defaults();
  try { const saved = JSON.parse(localStorage.getItem(storageKey)); if (saved && typeof saved === 'object') state = { ...state, ...saved }; } catch {}
  const applicable = entry => !entry.packages || entry.packages.includes(state.package);
  function sanitize() {
    if (!config.packages.some(entry => entry.id === state.package)) state.package = config.packages[0].id;
    const oldQuantities = state.quantities && typeof state.quantities === 'object' ? state.quantities : {};
    state.quantities = Object.fromEntries(config.quantities.filter(applicable).map(entry => [entry.id, Math.min(entry.max, Math.max(0, Math.trunc(Number(oldQuantities[entry.id]) || 0)))]));
    state.options = allOptions.filter(entry => applicable(entry) && Array.isArray(state.options) && state.options.includes(entry.id)).map(entry => entry.id);
    allOptions.filter(entry => entry.mandatory).forEach(entry => { if (!state.options.includes(entry.id)) state.options.push(entry.id); });
    state.options = state.options.filter(id => (allOptions.find(entry => entry.id === id).requires || []).every(required => state.options.includes(required)));
    state.custom = config.custom.filter(entry => Array.isArray(state.custom) && state.custom.includes(entry.id)).map(entry => entry.id);
    state.comment = typeof state.comment === 'string' ? state.comment.slice(0, 1000) : '';
  }
  sanitize();
  function save() { try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch {} }
  config.packages.forEach((entry, index) => {
    const label = el('label', 'package');
    const input = el('input'); input.type = 'radio'; input.name = 'package'; input.value = entry.id; input.checked = entry.id === state.package;
    const box = el('span', 'package-box'); const icon = el('span', 'package-icon'); icon.setAttribute('aria-hidden', 'true'); for(let i = 0; i <= index; i++) icon.append(el('i'));
    box.append(icon, el('strong', '', entry.name), el('span', 'package-description', entry.description), el('span', 'package-scope', entry.scope), el('span', 'package-price', unitPrice(entry.price)));
    label.append(input, box); $('#packages').append(label);
  });
  $('#market-note').textContent = config.pricingNote || '';
  config.included.forEach(text => $('#included').append(el('li', '', text)));
  function renderQuantities() {
    $('#quantities').replaceChildren();
    config.quantities.filter(applicable).forEach(entry => {
      const row = el('div', 'quantity-row'); const copy = el('div');
      const title = el('p', 'row-title', entry.name); title.id = `label-${entry.id}`;
      copy.append(title, el('p', 'row-description', entry.description), el('span', 'row-price', `${unitPrice(entry.price)} / ${entry.unit}`));
      const counter = el('div', 'counter');
      const minus = el('button', '', '−'); minus.type = 'button'; minus.dataset.counter = entry.id; minus.dataset.delta = '-1'; minus.setAttribute('aria-label', `Уменьшить: ${entry.name}`);
      const input = el('input'); input.type = 'number'; input.min = '0'; input.max = String(entry.max); input.step = '1'; input.value = state.quantities[entry.id]; input.dataset.quantity = entry.id; input.id = `quantity-${entry.id}`; input.setAttribute('aria-labelledby', title.id); input.inputMode = 'numeric';
      const plus = el('button', '', '+'); plus.type = 'button'; plus.dataset.counter = entry.id; plus.dataset.delta = '1'; plus.setAttribute('aria-label', `Увеличить: ${entry.name}`);
      counter.append(minus, input, plus); row.append(copy, counter); $('#quantities').append(row);
    });
  }
  function renderOptions() {
    $('#options').replaceChildren();
    config.groups.forEach(group => {
      const section = el('div', 'options-group'); section.append(el('h3', '', group.name));
      group.options.filter(applicable).forEach(entry => {
        const label = el('label', 'option'); const input = el('input'); input.type = 'checkbox'; input.dataset.option = entry.id; input.checked = state.options.includes(entry.id);
        const copy = el('span', 'option-copy'); const title = el('span', 'row-title', entry.name); title.id = `option-${entry.id}`;
        input.setAttribute('aria-labelledby', title.id); const description = el('span', 'row-description', entry.description + (entry.requires ? ' При выборе добавляется форма заявки.' : ''));
        copy.append(title, description);
        if (entry.mandatory) label.append(el('span', 'required-mark', '✓')); else label.append(input);
        label.append(copy, el('span', 'option-price', unitPrice(entry.price) + (entry.recurring ? ' / мес.' : ''))); section.append(label);
      }); $('#options').append(section);
    });
  }
  config.custom.forEach(entry => {
    const label = el('label', 'chip'); const input = el('input'); input.type = 'checkbox'; input.dataset.custom = entry.id; input.checked = state.custom.includes(entry.id); label.append(input, el('span', '', entry.name)); $('#custom').append(label);
  });
  $('#comment').value = state.comment;
  function lines() {
    const base = config.packages.find(entry => entry.id === state.package);
    return [
      { name: base.name, price: base.price, count: 1, base: true },
      ...config.quantities.filter(entry => applicable(entry) && state.quantities[entry.id] > 0).map(entry => ({ name: entry.name, price: entry.price, count: state.quantities[entry.id], unit: entry.unit })),
      ...allOptions.filter(entry => state.options.includes(entry.id)).map(entry => ({ name: entry.name, price: entry.price, count: 1, recurring: entry.recurring })),
      ...config.custom.filter(entry => state.custom.includes(entry.id)).map(entry => ({ name: entry.name, price: null, count: 1, custom: true }))
    ];
  }
  function estimate() {
    const selected = lines(); const regular = selected.filter(entry => !entry.custom && !entry.recurring); const known = regular.filter(entry => priced(entry.price)); const missing = regular.length - known.length;
    const subtotal = known.reduce((sum, entry) => sum + entry.price * entry.count, 0); const custom = selected.some(entry => entry.custom);
    const title = known.length === 0 ? 'Стоимость уточняется' : `${missing || custom ? 'от ' : ''}${rub(subtotal)}`;
    let note = known.length === 0 ? 'Цены пока не заполнены. Вы можете собрать список работ и скопировать его.' : missing ? `Показана только известная часть расчёта. Позиций без цены: ${missing}.` : 'Расчёт по выбранным работам. Окончательная стоимость — после согласования.';
    const monthly = selected.filter(entry => entry.recurring).reduce((sum, entry) => sum + entry.price, 0);
    return { selected, title, note, missing, custom, subtotal, monthly };
  }
  function update() {
    const base = config.packages.find(entry => entry.id === state.package); const result = estimate();
    $('#summary-title').textContent = base.name; $('#summary-scope').textContent = base.scope;
    $('#summary-lines').replaceChildren();
    result.selected.forEach(entry => {
      const row = el('div', 'summary-line'); row.append(el('span', '', entry.name + (entry.unit ? ` · ${entry.count} ${entry.unit}` : '')), el('b', '', entry.custom ? 'Обсудим' : priced(entry.price) ? rub(entry.price * entry.count) + (entry.recurring ? ' / мес.' : '') : 'Уточним')); $('#summary-lines').append(row);
    });
    $('#monthly-total').textContent = result.monthly ? `Обязательное обслуживание: ${rub(result.monthly)} / мес.` : '';
    $('#total').textContent = result.title; $('#mobile-total').textContent = result.title + (result.monthly ? ` + ${rub(result.monthly)}/мес.` : ''); $('#total-note').textContent = result.note; $('#custom-note').hidden = !result.custom;
    document.querySelectorAll('[data-quantity]').forEach(input => {
      const entry = config.quantities.find(item => item.id === input.dataset.quantity); input.value = state.quantities[entry.id]; const container = input.parentElement;
      container.querySelector('[data-delta="-1"]').disabled = state.quantities[entry.id] <= 0; container.querySelector('[data-delta="1"]').disabled = state.quantities[entry.id] >= entry.max;
    });
    document.querySelectorAll('[data-option]').forEach(input => { input.checked = state.options.includes(input.dataset.option); });
    $('#copy-status').textContent = ''; save();
  }
  function exportText() {
    const base = config.packages.find(entry => entry.id === state.package); const result = estimate();
    const rows = result.selected.map(entry => `• ${entry.name}${entry.unit ? ` — ${entry.count} ${entry.unit}` : ''}: ${entry.custom ? 'индивидуальная оценка' : priced(entry.price) ? rub(entry.price * entry.count) + (entry.recurring ? ' / мес.' : '') : 'стоимость уточняется'}`);
    return ['РАСЧЁТ САЙТА', base.scope, '', 'Выбранные работы:', ...rows, '', 'В базовый пакет входит:', ...config.included.map(text => `• ${text}`), '', `Разовая стоимость: ${result.title}`, result.monthly ? `Обязательное обслуживание (сервер и сопровождение): ${rub(result.monthly)} / мес.` : '', result.note, config.pricingNote || '', result.custom ? 'Индивидуальные задачи оценим отдельно.' : '', state.comment ? `\nО проекте: ${state.comment}` : '', '\nАренда сервера входит в обязательные 1 500 ₽/мес. Домен, перевод и подписки внешних сервисов оплачиваются отдельно. Итоговую цену согласуем после обсуждения задачи.'].filter(text => text !== '').join('\n');
  }
  $('#packages').addEventListener('change', event => { if (event.target.name !== 'package') return; state.package = event.target.value; sanitize(); renderQuantities(); renderOptions(); update(); });
  $('#quantities').addEventListener('click', event => {
    const button = event.target.closest('[data-counter]'); if (!button) return;
    const entry = config.quantities.find(item => item.id === button.dataset.counter); state.quantities[entry.id] = Math.min(entry.max, Math.max(0, state.quantities[entry.id] + Number(button.dataset.delta))); update();
  });
  $('#quantities').addEventListener('change', event => { const input = event.target.closest('[data-quantity]'); if(!input) return; state.quantities[input.dataset.quantity] = input.value; sanitize(); update(); });
  $('#options').addEventListener('change', event => {
    const input = event.target.closest('[data-option]'); if(!input) return; const id = input.dataset.option;
    if(input.checked) { state.options.push(id); (allOptions.find(entry => entry.id === id).requires || []).forEach(required => { if(!state.options.includes(required)) state.options.push(required); }); }
    else state.options = state.options.filter(item => item !== id);
    sanitize(); update();
  });
  $('#custom').addEventListener('change', event => { const input = event.target.closest('[data-custom]'); if(!input) return; state.custom = input.checked ? [...state.custom, input.dataset.custom] : state.custom.filter(id => id !== input.dataset.custom); update(); });
  $('#comment').addEventListener('input', event => { state.comment = event.target.value; save(); $('#copy-status').textContent = ''; });
  $('#copy').addEventListener('click', async () => {
    const text = exportText(); try { await navigator.clipboard.writeText(text); $('#copy-status').textContent = 'Готово! Расчёт скопирован.'; }
    catch { $('#copy-text').value = text; $('#copy-dialog').showModal(); $('#copy-text').focus(); $('#copy-text').select(); }
  });
  $('#close-copy').addEventListener('click', () => $('#copy-dialog').close());
  $('#reset').addEventListener('click', () => { state = defaults(); sanitize(); document.querySelectorAll('[name="package"]').forEach(input => input.checked = input.value === state.package); document.querySelectorAll('[data-custom]').forEach(input => input.checked = false); $('#comment').value = ''; renderQuantities(); renderOptions(); update(); $('#copy-status').textContent = 'Выбор сброшен.'; });
  renderQuantities(); renderOptions(); update();
  // Keep the mobile shortcut out of the way while the full estimate is in view.
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => { const visible = entries[0].isIntersecting; $('.mobile-total').style.display = visible ? 'none' : ''; }, { threshold: 0 }).observe($('.summary'));
})();
