'use strict';

(() => {
  const views = [...document.querySelectorAll('.view')];
  const navItems = [...document.querySelectorAll('[data-view]')];
  const title = document.getElementById('page-title');
  const description = document.getElementById('page-description');
  const toast = document.getElementById('toast');

  const pageCopy = {
    overview: ['Overview', 'The tools that keep the Cottage running, in one place.'],
    'reaction-roles': ['Reaction roles', 'Set up self-assignable roles from a message.'],
    sticky: ['Sticky messages', 'Keep important information at the bottom of a channel.'],
    say: ['Say a message', 'Post a message as The Cottage★ BOT.'],
    welcome: ['Welcome messages', 'Give new members a proper hello.'],
    boost: ['Server boosts', 'Celebrate members who support your server.'],
    leave: ['Leave messages', 'Choose what happens when a member leaves.'],
    voice: ['Join-to-create', 'Configure temporary voice rooms for your members.'],
  };

  let toastTimer;
  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
  }

  function showView(name) {
    if (!pageCopy[name]) return;
    for (const view of views) view.classList.toggle('active', view.id === 'view-' + name);
    for (const item of navItems) item.classList.toggle('active', item.dataset.view === name);
    title.textContent = pageCopy[name][0];
    description.textContent = pageCopy[name][1];
    if (location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
  }

  for (const item of navItems) {
    item.addEventListener('click', () => showView(item.dataset.view));
  }

  const initialView = location.hash.slice(1);
  showView(pageCopy[initialView] ? initialView : 'overview');

  // The first commit is a visual foundation. Keep every control disabled until
  // OAuth, per-guild authorization, and the bot's authenticated API are wired.
  for (const form of document.querySelectorAll('form')) {
    form.addEventListener('submit', event => {
      event.preventDefault();
      showToast('Discord sign-in and saving are being connected next.');
    });
  }
})();
