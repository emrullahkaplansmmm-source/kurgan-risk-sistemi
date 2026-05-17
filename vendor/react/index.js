const roots = new Set();
let activeRoot = null;
let hookIndex = 0;

export const StrictMode = Symbol('StrictMode');

export function createElement(type, props, ...children) {
  return { type, props: props || {}, children: children.flat(Infinity).filter((child) => child !== false && child !== true && child !== null && child !== undefined) };
}

function depsChanged(previous, next) {
  if (!previous || !next || previous.length !== next.length) return true;
  return next.some((value, index) => !Object.is(value, previous[index]));
}

function currentHook(initialValue) {
  const root = activeRoot;
  const index = hookIndex;
  if (!root) throw new Error('Hooks can only be used while rendering a component.');
  if (!(index in root.hooks)) root.hooks[index] = typeof initialValue === 'function' ? initialValue() : initialValue;
  hookIndex += 1;
  return [root, index];
}

export function useState(initialValue) {
  const [root, index] = currentHook(initialValue);
  const setState = (nextValue) => {
    const next = typeof nextValue === 'function' ? nextValue(root.hooks[index]) : nextValue;
    if (!Object.is(root.hooks[index], next)) {
      root.hooks[index] = next;
      root.schedule();
    }
  };
  return [root.hooks[index], setState];
}

export function useRef(initialValue) {
  const [root, index] = currentHook({ current: initialValue });
  return root.hooks[index];
}

export function useMemo(factory, deps) {
  const [root, index] = currentHook(null);
  const memo = root.hooks[index];
  if (!memo || depsChanged(memo.deps, deps)) {
    root.hooks[index] = { deps, value: factory() };
  }
  return root.hooks[index].value;
}

export function useEffect(effect, deps) {
  const [root, index] = currentHook(null);
  const previous = root.hooks[index];
  if (!previous || depsChanged(previous.deps, deps)) {
    root.pendingEffects.push({ index, effect, deps });
  }
}

export function renderVNode(vnode, root) {
  if (Array.isArray(vnode)) {
    const fragment = document.createDocumentFragment();
    vnode.forEach((child) => fragment.appendChild(renderVNode(child, root)));
    return fragment;
  }

  if (vnode === null || vnode === undefined || vnode === false || vnode === true) return document.createTextNode('');
  if (typeof vnode === 'string' || typeof vnode === 'number') return document.createTextNode(String(vnode));

  if (vnode.type === StrictMode) return renderVNode(vnode.children, root);

  if (typeof vnode.type === 'function') {
    const previousRoot = activeRoot;
    const previousHookIndex = hookIndex;
    activeRoot = root;
    hookIndex = 0;
    const rendered = vnode.type({ ...vnode.props, children: vnode.children });
    activeRoot = previousRoot;
    hookIndex = previousHookIndex;
    return renderVNode(rendered, root);
  }

  const element = document.createElement(vnode.type);
  Object.entries(vnode.props || {}).forEach(([key, value]) => {
    if (key === 'children' || value === undefined || value === null || value === false) return;
    if (key === 'className') element.setAttribute('class', value);
    else if (key === 'style' && typeof value === 'object') Object.assign(element.style, value);
    else if (key.startsWith('on') && typeof value === 'function') element.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value === true) element.setAttribute(key, '');
    else element.setAttribute(key, String(value));
  });
  vnode.children.forEach((child) => element.appendChild(renderVNode(child, root)));
  return element;
}

export function createInternalRoot(container) {
  const root = {
    container,
    hooks: [],
    pendingEffects: [],
    vnode: null,
    scheduled: false,
    schedule() {
      if (root.scheduled) return;
      root.scheduled = true;
      queueMicrotask(() => {
        root.scheduled = false;
        root.commit();
      });
    },
    commit() {
      root.pendingEffects = [];
      container.replaceChildren(renderVNode(root.vnode, root));
      root.pendingEffects.forEach(({ index, effect, deps }) => {
        const previous = root.hooks[index];
        if (previous?.cleanup) previous.cleanup();
        const cleanup = effect();
        root.hooks[index] = { deps, cleanup: typeof cleanup === 'function' ? cleanup : undefined };
      });
    },
    render(vnode) {
      root.vnode = vnode;
      root.commit();
    },
  };
  roots.add(root);
  return root;
}

const React = { createElement, StrictMode, useEffect, useMemo, useRef, useState };
export default React;
