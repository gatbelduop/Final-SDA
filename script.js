const hymnsData = window.hymnsData;
const pageOrder = ['home', 'hymns', 'favorites', 'contacts', 'about', 'settings'];
        const youthSongsStartId = 711;

        // Add recordings as hymn ID and relative audio file path pairs, for example: 1: 'audio/1.mp3'.
        const hymnAudioSources = {};

        const initialUrl = new URL(window.location.href);
        const requestedApp = initialUrl.searchParams.get('app');
        let currentApp = requestedApp === 'youth' || requestedApp === 'main'
            ? requestedApp
            : localStorage.getItem('nuer_sda_active_app') === 'youth' ? 'youth' : 'main';
        let currentHymnId = 1;
        let favorites = JSON.parse(localStorage.getItem('nuer_sda_favs')) || [];
        let recentHymns = JSON.parse(localStorage.getItem('nuer_sda_recents')) || [];
        let youthRecentHymns = JSON.parse(localStorage.getItem('nuer_sda_youth_recents')) || [];
        let hymnCategoryOverrides = JSON.parse(localStorage.getItem('nuer_sda_category_overrides')) || {};
        let hymnEdits = JSON.parse(localStorage.getItem('nuer_sda_hymn_edits')) || {};
        let editorRole = null;
        const deepLinkedHymnId = Number(initialUrl.searchParams.get('hymn'));

        // Initialize App
        document.addEventListener('DOMContentLoaded', () => {
            initNavigation();
            updateAppIdentity();
            navigateTo('home');
            applyChurchPresence(localStorage.getItem('nuer_sda_church_presence') === 'true');
            renderHymnsList();
            renderCategories();
            updateFavoritesBadge();
            renderSongOfTheDay();
            renderRecentHymns();
            initSettings();
            initEditorAccess();
            document.getElementById('save-song-edits-btn').addEventListener('click', saveSongEdits);
            document.getElementById('save-hymn-category-btn').addEventListener('click', saveHymnCategory);

            if (requestedApp === 'main' || requestedApp === 'youth') {
                localStorage.setItem('nuer_sda_active_app', currentApp);
            }
            if (Number.isInteger(deepLinkedHymnId) &&
                getActiveHymns().some(hymn => hymn.id === deepLinkedHymnId)) {
                openHymn(deepLinkedHymnId);
            }

            // Setup robust side-by-side swipe navigation and end-of-page quit prompt
            initMobileGestures();
        });

        // Navigation Router
        function navigateTo(pageId) {
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            const target = document.getElementById(pageId + '-page');
            if (target) {
                target.classList.add('active');
                window.scrollTo(0, 0);
            }
            document.querySelectorAll('.sidebar-nav ul li a').forEach(a => {
                a.classList.toggle('active', a.getAttribute('data-page') === pageId ||
                    a.getAttribute('data-app') === currentApp);
            });
            closeSidebar();
            if (pageId === 'favorites') {
                renderFavoritesList();
            }
        }

        function getActiveHymns() {
            return hymnsData.filter(hymn => currentApp === 'youth'
                ? hymn.id >= youthSongsStartId
                : hymn.id < youthSongsStartId)
                .map(hymn => ({
                    ...hymn,
                    ...hymnEdits[hymn.id],
                    id: hymn.id,
                    category: hymnCategoryOverrides[hymn.id] || hymnEdits[hymn.id]?.category || hymn.category
                }));
        }

        function getDisplayTitle(hymn) {
            if (currentApp !== 'youth') return hymn.title;
            const youthNumber = getActiveHymns().findIndex(item => item.id === hymn.id) + 1;
            const title = hymn.title.replace(/^\s*\d+\.\s*/, '').trim();
            return `${youthNumber}. ${title}`;
        }

        function getHymnCategory(hymn) {
            return hymnCategoryOverrides[hymn.id] || hymn.category || 'Uncategorized';
        }

        function getActiveCategories() {
            return [...new Set(getActiveHymns().map(getHymnCategory))].sort((a, b) => a.localeCompare(b));
        }

        function escapeHtml(value) {
            return String(value).replace(/[&<>"']/g, character => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            })[character]);
        }

        function lyricsToText(lyrics) {
            const text = document.createElement('textarea');
            text.innerHTML = String(lyrics).replace(/<br\s*\/?>/gi, '\n');
            return text.value;
        }

        function renderLyrics(lyrics) {
            return String(lyrics).split(/(<br\s*\/?>)/gi).map(part =>
                /^<br\s*\/?>$/i.test(part) ? '<br>' : escapeHtml(part)
            ).join('');
        }

        function updateAppIdentity() {
            const isYouth = currentApp === 'youth';
            const appName = isYouth ? 'Youth Songs' : 'Nuer SDA Hymnal';
            const songLabel = isYouth ? 'Songs' : 'Hymns';
            document.title = appName;
            document.getElementById('app-title').textContent = appName;
            document.getElementById('header-logo').alt = `${appName} logo`;
            document.getElementById('home-title').textContent = `Welcome to ${appName}`;
            document.getElementById('home-subtitle').textContent = isYouth
                ? 'Explore and worship with the Youth Songs collection'
                : 'Worship in your heart language (Thok Nath) anytime, anywhere';
            document.getElementById('library-button-label').textContent = `Explore ${songLabel} Library`;
            document.getElementById('recent-heading').textContent = `Recently Viewed ${songLabel}`;
            document.getElementById('detail-back-label').textContent = `All ${songLabel}`;
            document.getElementById('favorites-heading').textContent = `Favorite ${songLabel}`;
            document.getElementById('audio-heading').textContent =
                `Listen to this ${isYouth ? 'song' : 'hymn'}`;
            document.getElementById('favorites-shortcut').title = `Favorite ${songLabel}`;
            document.querySelector('[data-page="hymns"]').innerHTML =
                `<i class="fas fa-book-open"></i> All ${songLabel}`;
            document.querySelector('[data-page="favorites"]').innerHTML =
                `<i class="fas fa-heart"></i> Favorite ${songLabel}`;
        }

        function switchApp(app) {
            if (app !== 'main' && app !== 'youth') return;
            currentApp = app;
            localStorage.setItem('nuer_sda_active_app', currentApp);
            updateAppIdentity();
            document.getElementById('hymn-search').value = '';
            renderCategories();
            renderHymnsList();
            updateFavoritesBadge();
            renderFavoritesList();
            renderSongOfTheDay();
            renderRecentHymns();
            navigateTo('home');
        }

        function initNavigation() {
            const hamburger = document.getElementById('hamburger');
            const sidebar = document.getElementById('sidebar-nav');
            const overlay = document.getElementById('nav-overlay');
            const closeBtn = document.getElementById('sidebar-close');

            hamburger.addEventListener('click', () => {
                sidebar.classList.add('active');
                overlay.classList.add('active');
            });

            closeBtn.addEventListener('click', closeSidebar);
            overlay.addEventListener('click', closeSidebar);

            document.querySelectorAll('.sidebar-nav ul li a').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const app = link.getAttribute('data-app');
                    if (app) {
                        switchApp(app);
                    } else {
                        const page = link.getAttribute('data-page');
                        navigateTo(page);
                    }
                });
            });

            document.getElementById('clear-favs-btn').addEventListener('click', () => {
                const activeIds = new Set(getActiveHymns().map(hymn => hymn.id));
                const activeFavorites = favorites.filter(id => activeIds.has(id));
                if (activeFavorites.length === 0) {
                    showToast('No favorites to clear');
                    return;
                }
                const songLabel = currentApp === 'youth' ? 'songs' : 'hymns';
                if (!confirm(`Clear all favorite ${songLabel}?`)) return;
                favorites = favorites.filter(id => !activeIds.has(id));
                localStorage.setItem('nuer_sda_favs', JSON.stringify(favorites));
                updateFavoritesBadge();
                renderHymnsList();
                renderFavoritesList();
                showToast(`Favorite ${songLabel} cleared`);
            });
        }

        function closeSidebar() {
            document.getElementById('sidebar-nav').classList.remove('active');
            document.getElementById('nav-overlay').classList.remove('active');
        }

        // Render Hymns List
        function renderHymnsList() {
            const container = document.getElementById('hymns-list');
            const searchInput = document.getElementById('hymn-search');
            const categorySelect = document.getElementById('category-filter');
            const countDisplay = document.getElementById('hymn-count-display');

            const query = searchInput ? searchInput.value.toLowerCase() : '';
            const cat = categorySelect ? categorySelect.value : '';

            const activeHymns = getActiveHymns();
            const filtered = activeHymns.filter(h => {
                const matchQuery = getDisplayTitle(h).toLowerCase().includes(query) ||
                    h.author.toLowerCase().includes(query) ||
                    h.lyrics.toLowerCase().includes(query);
                const matchCat = cat === '' || getHymnCategory(h) === cat;
                return matchQuery && matchCat;
            });

            const songLabel = currentApp === 'youth' ? 'songs' : 'hymns';
            countDisplay.innerText = `Total ${songLabel} in app: ${activeHymns.length} (Showing ${filtered.length})`;

            if (filtered.length === 0) {
                const songLabel = currentApp === 'youth' ? 'songs' : 'hymns';
                container.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:2rem;">No ${songLabel} found.</div>`;
                return;
            }

            container.innerHTML = filtered.map(h => {
                const isFav = favorites.includes(h.id);
                return `
                    <div class="hymn-card" onclick="openHymn(${h.id})">
                        <h4>${escapeHtml(getDisplayTitle(h))} <span style="font-size:12px; color:var(--text-muted); font-weight:normal;">(${escapeHtml(h.author)})</span></h4>
                        <i class="fas fa-heart favorite-icon ${isFav ? 'active' : ''}" onclick="event.stopPropagation(); toggleFavorite(${h.id})"></i>
                    </div>
                `;
            }).join('');

            if (searchInput && !searchInput.hasAttribute('listener')) {
                searchInput.setAttribute('listener', 'true');
                searchInput.addEventListener('input', renderHymnsList);
            }
            if (categorySelect && !categorySelect.hasAttribute('listener')) {
                categorySelect.setAttribute('listener', 'true');
                categorySelect.addEventListener('change', renderHymnsList);
            }
        }

        function renderCategories() {
            const select = document.getElementById('category-filter');
            const selectedCategory = select.value;
            select.innerHTML = '<option value="">All Categories</option>';
            getActiveCategories().forEach(c => {
                const opt = document.createElement('option');
                opt.value = c;
                opt.innerText = c;
                select.appendChild(opt);
            });
            if (getActiveCategories().includes(selectedCategory)) {
                select.value = selectedCategory;
            }
        }

        // Open Hymn Detail
        function openHymn(id) {
            currentHymnId = id;
            addToRecent(id);
            navigateTo('hymn-detail');
            renderHymnDetail();
        }

        function renderHymnDetail() {
            const hymn = getActiveHymns().find(h => h.id === currentHymnId);
            if (!hymn) return;

            const header = document.getElementById('hymn-detail-header');
            const display = document.getElementById('lyrics-display');
            const favText = document.getElementById('fav-toggle-text');
            const favBtn = document.getElementById('fav-toggle-detail');
            const notesTextarea = document.getElementById('hymn-notes');
            const audioPlayer = document.getElementById('hymn-audio-player');
            const audioStatus = document.getElementById('hymn-audio-status');
            const audioSource = hymnAudioSources[hymn.id];
            const songLabel = currentApp === 'youth' ? 'song' : 'hymn';
            const categorySelect = document.getElementById('hymn-category-select');
            const categoryStatus = document.getElementById('hymn-category-status');
            const categoryEditor = document.querySelector('.category-editor');
            const songEditPanel = document.getElementById('song-edit-panel');

            audioPlayer.pause();
            audioPlayer.removeAttribute('src');
            audioPlayer.hidden = !audioSource;
            audioPlayer.setAttribute('aria-label', `${songLabel} audio playback`);
            audioStatus.hidden = Boolean(audioSource);
            audioStatus.textContent = `Audio recording is not available for this ${songLabel} yet.`;
            if (audioSource) {
                audioPlayer.src = audioSource;
                audioPlayer.onerror = () => {
                    audioStatus.textContent = `This ${songLabel} recording could not be loaded.`;
                    audioStatus.hidden = false;
                };
                audioPlayer.load();
            } else {
                audioPlayer.onerror = null;
            }

            header.innerHTML = `
                <h3>${escapeHtml(getDisplayTitle(hymn))}</h3>
                <div class="hymn-meta">Category: ${escapeHtml(getHymnCategory(hymn))} &bull; Author: ${escapeHtml(hymn.author)}</div>
            `;

            categorySelect.innerHTML = '';
            getActiveCategories().forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                categorySelect.appendChild(option);
            });
            categorySelect.value = getHymnCategory(hymn);
            document.getElementById('new-hymn-category').value = '';
            categoryStatus.textContent = '';
            categoryEditor.hidden = !editorRole;
            songEditPanel.hidden = !editorRole;
            if (editorRole) {
                document.getElementById('edit-song-title').value = hymn.title;
                document.getElementById('edit-song-author').value = hymn.author;
                document.getElementById('edit-song-lyrics').value =
                    lyricsToText(hymn.lyrics).replace(/\n{3,}/g, '\n\n');
            }

            display.innerHTML = renderLyrics(hymn.lyrics);

            const isFav = favorites.includes(hymn.id);
            favText.innerText = isFav ? 'Favorited' : 'Favorite';
            favBtn.querySelector('i').className = `fas fa-heart ${isFav ? 'text-rose-500' : 'text-muted'}`;

            // Load saved notes
            const savedNotes = localStorage.getItem(`hymn_notes_${hymn.id}`) || '';
            notesTextarea.value = savedNotes;

            // Setup buttons
            document.getElementById('fav-toggle-detail').onclick = () => toggleFavorite(hymn.id);
            document.getElementById('copy-btn').onclick = () => copyLyrics(hymn);
            document.getElementById('share-btn').onclick = () => shareHymn(hymn);
            document.getElementById('prev-hymn-btn').onclick = () => navigateHymn(-1);
            document.getElementById('next-hymn-btn').onclick = () => navigateHymn(1);
            document.getElementById('save-notes-btn').onclick = () => saveNotes(hymn.id);
            document.getElementById('paste-notes-btn').onclick = pasteToNotes;
        }

        function saveHymnCategory() {
            if (!editorRole) {
                showToast('Unlock as an admin or permitted editor to edit songs.');
                return;
            }
            const hymn = getActiveHymns().find(item => item.id === currentHymnId);
            if (!hymn) return;
            const newCategory = document.getElementById('new-hymn-category').value.trim();
            const category = newCategory || document.getElementById('hymn-category-select').value;
            if (!category) {
                showToast('Choose or enter a category first.');
                return;
            }
            hymnCategoryOverrides[hymn.id] = category;
            localStorage.setItem('nuer_sda_category_overrides', JSON.stringify(hymnCategoryOverrides));
            renderCategories();
            renderHymnsList();
            renderHymnDetail();
            showToast('Hymn category saved.');
        }

        function saveSongEdits() {
            if (!editorRole) {
                showToast('Unlock as an admin or permitted editor to edit songs.');
                return;
            }
            const hymn = getActiveHymns().find(item => item.id === currentHymnId);
            if (!hymn) return;
            const title = document.getElementById('edit-song-title').value.trim();
            const author = document.getElementById('edit-song-author').value.trim();
            const lyrics = document.getElementById('edit-song-lyrics').value.trim();
            if (!title || !lyrics) {
                showToast('Song title and lyrics are required.');
                return;
            }
            hymnEdits[hymn.id] = {
                title,
                author,
                lyrics: lyrics.split(/\n{2,}/)
                    .map(verse => verse.split('\n').map(escapeHtml).join('<br>'))
                    .join('<br><br>')
            };
            localStorage.setItem('nuer_sda_hymn_edits', JSON.stringify(hymnEdits));
            renderCategories();
            renderHymnsList();
            renderFavoritesList();
            renderRecentHymns();
            renderSongOfTheDay();
            renderHymnDetail();
            showToast('Song changes saved in this browser.');
        }

        function navigateHymn(direction) {
            const activeHymns = getActiveHymns();
            const index = activeHymns.findIndex(h => h.id === currentHymnId);
            let newIndex = index + direction;
            if (newIndex < 0) newIndex = activeHymns.length - 1;
            if (newIndex >= activeHymns.length) newIndex = 0;
            openHymn(activeHymns[newIndex].id);
        }

        // Side-by-side Page & Song Navigation with Quit Trigger at Home edge
        function navigatePageOrQuit(direction) {
            const activePageEl = document.querySelector('.page.active');
            if (!activePageEl) return;
            const activeId = activePageEl.id.replace('-page', '');

            // If on song reader page, side swipe cycles songs
            if (activeId === 'hymn-detail') {
                navigateHymn(direction);
                showToast(direction > 0 ? 'Swiped: Next Song' : 'Swiped: Previous Song');
                return;
            }

            let currentIndex = pageOrder.indexOf(activeId);
            if (currentIndex === -1) currentIndex = 0;
            let newIndex = currentIndex + direction;

            // If user swipes right past the 'home' page (index 0), trigger quit app prompt
            if (activeId === 'home' && direction < 0) {
                showQuitPrompt();
                return;
            }

            if (newIndex < 0) newIndex = pageOrder.length - 1;
            if (newIndex >= pageOrder.length) newIndex = 0;

            const targetPage = pageOrder[newIndex];
            navigateTo(targetPage);
            showToast(`Swiped to: ${targetPage.charAt(0).toUpperCase() + targetPage.slice(1)}`);
        }

        // Favorites Management
        function toggleFavorite(id) {
            if (favorites.includes(id)) {
                favorites = favorites.filter(i => i !== id);
                showToast('Removed from favorites');
            } else {
                favorites.push(id);
                showToast('Added to favorites');
            }
            localStorage.setItem('nuer_sda_favs', JSON.stringify(favorites));
            updateFavoritesBadge();
            renderHymnsList();
            if (document.getElementById('hymn-detail-page').classList.contains('active')) {
                renderHymnDetail();
            }
            if (document.getElementById('favorites-page').classList.contains('active')) {
                renderFavoritesList();
            }
        }

        function updateFavoritesBadge() {
            const badge = document.getElementById('fav-badge');
            const favoriteCount = getActiveHymns().filter(hymn => favorites.includes(hymn.id)).length;
            if (favoriteCount > 0) {
                badge.style.display = 'flex';
                badge.innerText = favoriteCount;
            } else {
                badge.style.display = 'none';
            }
        }

        function renderFavoritesList() {
            const container = document.getElementById('favorites-list');
            const favHymns = getActiveHymns().filter(h => favorites.includes(h.id));

            if (favHymns.length === 0) {
                const songLabel = currentApp === 'youth' ? 'songs' : 'hymns';
                container.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:2rem;">No favorite ${songLabel} saved yet.</div>`;
                return;
            }

            container.innerHTML = favHymns.map(h => `
                <div class="hymn-card" onclick="openHymn(${h.id})">
                    <h4>${escapeHtml(getDisplayTitle(h))} <span style="font-size:12px; color:var(--text-muted); font-weight:normal;">(${escapeHtml(h.author)})</span></h4>
                    <i class="fas fa-heart favorite-icon active" onclick="event.stopPropagation(); toggleFavorite(${h.id})"></i>
                </div>
            `).join('');
        }

        // Recent Hymns
        function addToRecent(id) {
            const recents = getActiveRecentHymns().filter(i => i !== id);
            recents.unshift(id);
            if (recents.length > 5) recents.pop();
            if (currentApp === 'youth') {
                youthRecentHymns = recents;
                localStorage.setItem('nuer_sda_youth_recents', JSON.stringify(youthRecentHymns));
            } else {
                recentHymns = recents;
                localStorage.setItem('nuer_sda_recents', JSON.stringify(recentHymns));
            }
            renderRecentHymns();
        }

        function getActiveRecentHymns() {
            return currentApp === 'youth' ? youthRecentHymns : recentHymns;
        }

        function renderRecentHymns() {
            const container = document.getElementById('recent-hymns-list');
            const recentIds = getActiveRecentHymns();
            const recents = getActiveHymns().filter(h => recentIds.includes(h.id));

            if (recents.length === 0) {
                const songLabel = currentApp === 'youth' ? 'songs' : 'hymns';
                container.innerHTML = `<div style="font-size:13px; color:var(--text-muted);">No recently viewed ${songLabel}.</div>`;
                return;
            }

            container.innerHTML = recents.map(h => `
                <div class="hymn-card" onclick="openHymn(${h.id})">
                    <h4>${escapeHtml(getDisplayTitle(h))}</h4>
                    <i class="fas fa-chevron-right" style="font-size:12px; color:var(--text-muted);"></i>
                </div>
            `).join('');
        }

        // Song of the day
        function renderSongOfTheDay(chooseAnother = false) {
            const container = document.getElementById('song-of-the-day-container');
            const activeHymns = getActiveHymns();
            const dayKey = currentApp === 'youth' ? 'nuer_sda_youth_song_of_day' : 'nuer_sda_hymn_of_day';
            const dateKeyName = `${dayKey}_date`;
            const today = new Date();
            const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            const savedDate = localStorage.getItem(dateKeyName);
            const savedHymnId = Number(localStorage.getItem(dayKey));
            let hymn = !chooseAnother && savedDate === dateKey
                ? activeHymns.find(item => item.id === savedHymnId)
                : null;

            if (!hymn) {
                const choices = chooseAnother && activeHymns.length > 1
                    ? activeHymns.filter(item => item.id !== savedHymnId)
                    : activeHymns;
                hymn = choices[Math.floor(Math.random() * choices.length)];
                localStorage.setItem(dateKeyName, dateKey);
                localStorage.setItem(dayKey, hymn.id);
            }

            const songLabel = currentApp === 'youth' ? 'Song' : 'Hymn';
            container.innerHTML = `
                <div class="glowing-container" style="text-align: left; padding: 1.25rem 1.5rem;">
                    <div style="font-size: 11px; font-weight: 700; color: var(--accent); text-transform: uppercase; margin-bottom: 4px;">⭐ ${songLabel} of the Day</div>
                    <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 4px;">${escapeHtml(getDisplayTitle(hymn))}</h3>
                    <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">${escapeHtml(hymn.author)} &bull; ${escapeHtml(getHymnCategory(hymn))}</p>
                    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                        <button class="btn-primary" style="padding: 6px 16px; font-size: 13px;" onclick="openHymn(${hymn.id})">Sing ${songLabel}</button>
                        <button class="btn-secondary" style="padding: 6px 16px; font-size: 13px;" onclick="renderSongOfTheDay(true)"><i class="fas fa-shuffle"></i> Surprise Me</button>
                    </div>
                </div>
            `;
        }

        // Utility actions
        function copyLyrics(hymn) {
            const text = `${getDisplayTitle(hymn)} (${hymn.author})\n\n${lyricsToText(hymn.lyrics)}`;
            navigator.clipboard.writeText(text).then(() => showToast('Lyrics copied to clipboard!'));
        }

        function shareHymn(hymn) {
            const url = new URL(window.location.href);
            url.searchParams.set('hymn', hymn.id);
            url.searchParams.set('app', currentApp);
            const shareUrl = url.toString();
            const title = getDisplayTitle(hymn);
            const text = `Check out ${title} in ${currentApp === 'youth' ? 'Youth Songs' : 'Nuer SDA Hymnal'}:`;

            if (navigator.share) {
                navigator.share({ title, text, url: shareUrl }).catch(error => {
                    if (error.name !== 'AbortError') {
                        showToast('Unable to share this hymn.');
                    }
                });
                return;
            }

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(`${text} ${shareUrl}`)
                    .then(() => showToast('Hymn link copied to clipboard.'))
                    .catch(() => showToast('Unable to copy the hymn link.'));
                return;
            }

            window.prompt('Copy this hymn link:', shareUrl);
        }

        function saveNotes(id) {
            const text = document.getElementById('hymn-notes').value;
            localStorage.setItem(`hymn_notes_${id}`, text);
            showToast('Study notes saved successfully!');
        }

        async function pasteToNotes() {
            try {
                const text = await navigator.clipboard.readText();
                document.getElementById('hymn-notes').value += (document.getElementById('hymn-notes').value ? '\n' : '') + text;
                showToast('Clipboard pasted to notes!');
            } catch (err) {
                showToast('Unable to read clipboard');
            }
        }

        function showToast(message) {
            const existing = document.querySelector('.toast');
            if (existing) existing.remove();

            const toast = document.createElement('div');
            toast.className = 'toast';
            toast.innerText = message;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 2500);
        }

        // Church Presence toggle
        function setChurchPresence(isInChurch) {
            localStorage.setItem('nuer_sda_church_presence', String(isInChurch));
            applyChurchPresence(isInChurch);
            if (isInChurch) {
                showToast('Church presence activated: Blessed Sabbath worship!');
            } else {
                showToast('Set to home worship: Be bless whereever you are.');
            }
        }

        function applyChurchPresence(isInChurch) {
            const yesBtn = document.getElementById('quest-btn-yes');
            const noBtn = document.getElementById('quest-btn-no');
            yesBtn.classList.toggle('active-yes', isInChurch);
            noBtn.classList.toggle('active-yes', !isInChurch);
            yesBtn.setAttribute('aria-pressed', String(isInChurch));
            noBtn.setAttribute('aria-pressed', String(!isInChurch));
        }

        // Settings init & Color Palettes
        const palettes = [
            { accent: '#2563eb', hover: '#1d4ed8', tint: 'rgba(37, 99, 235, 0.06)', border: 'rgba(37, 99, 235, 0.25)' }, // Blue
            { accent: '#991b1b', hover: '#7f1d1d', tint: 'rgba(153, 27, 27, 0.06)', border: 'rgba(153, 27, 27, 0.25)' }, // Maroon
            { accent: '#166534', hover: '#14532d', tint: 'rgba(22, 101, 52, 0.06)', border: 'rgba(22, 101, 52, 0.25)' },  // Green
            { accent: '#6b21a8', hover: '#581c87', tint: 'rgba(107, 33, 168, 0.06)', border: 'rgba(107, 33, 168, 0.25)' }, // Purple
            { accent: '#e11d48', hover: '#be123c', tint: 'rgba(225, 29, 72, 0.06)', border: 'rgba(225, 29, 72, 0.25)' }, // Rose
            { accent: '#0f766e', hover: '#115e59', tint: 'rgba(15, 118, 110, 0.06)', border: 'rgba(15, 118, 110, 0.25)' }, // Teal
            { accent: '#d97706', hover: '#b45309', tint: 'rgba(217, 119, 6, 0.06)', border: 'rgba(217, 119, 6, 0.25)' }, // Amber
            { accent: '#0891b2', hover: '#0e7490', tint: 'rgba(8, 145, 178, 0.06)', border: 'rgba(8, 145, 178, 0.25)' }, // Cyan
            { accent: '#ea580c', hover: '#c2410c', tint: 'rgba(234, 88, 12, 0.06)', border: 'rgba(234, 88, 12, 0.25)' }, // Orange
            { accent: '#475569', hover: '#334155', tint: 'rgba(71, 85, 105, 0.06)', border: 'rgba(71, 85, 105, 0.25)' } // Slate
        ];

        function applyPalette(index) {
            const p = palettes[index] || palettes[0];
            const root = document.documentElement;
            root.style.setProperty('--accent', p.accent);
            root.style.setProperty('--accent-hover', p.hover);
            root.style.setProperty('--glow-tint', p.tint);
            root.style.setProperty('--glow-border', p.border);
            localStorage.setItem('nuer_sda_palette', index);
        }

        function initSettings() {
            const savedPalette = localStorage.getItem('nuer_sda_palette');
            const previousPalette = savedPalette === null ? -1 : Number(savedPalette);
            const paletteChoices = palettes
                .map((_, index) => index)
                .filter(index => index !== previousPalette);
            const randomPalette = paletteChoices[Math.floor(Math.random() * paletteChoices.length)];
            applyPalette(randomPalette);
            document.getElementById('settings-palette-select').value = randomPalette;

            document.getElementById('settings-palette-select').addEventListener('change', (e) => {
                applyPalette(e.target.value);
            });

            document.getElementById('quick-palette-btn').addEventListener('click', () => {
                let current = parseInt(localStorage.getItem('nuer_sda_palette') || 0);
                current = (current + 1) % palettes.length;
                applyPalette(current);
                document.getElementById('settings-palette-select').value = current;
                showToast(`Switched color palette style #${current + 1}`);
            });

            // Theme selector
            const themeSelect = document.getElementById('theme-select');
            const savedTheme = localStorage.getItem('nuer_sda_theme') || 'auto';
            themeSelect.value = savedTheme;
            applyTheme(savedTheme);

            themeSelect.addEventListener('change', (e) => {
                applyTheme(e.target.value);
                localStorage.setItem('nuer_sda_theme', e.target.value);
            });

            document.getElementById('reset-data-btn').addEventListener('click', () => {
                if (confirm('Are you sure you want to reset all app settings and favorites?')) {
                    localStorage.clear();
                    location.reload();
                }
            });
        }

                const editorAccessKey = 'nuer_sda_editor_access';

                async function createPassphraseRecord(passphrase) {
                    if (!window.crypto?.subtle) {
                        throw new Error('Secure passphrase storage is not available in this browser.');
                    }
                    const salt = window.crypto.getRandomValues(new Uint8Array(16));
                    const key = await window.crypto.subtle.importKey(
                        'raw',
                        new TextEncoder().encode(passphrase),
                        'PBKDF2',
                        false,
                        ['deriveBits']
                    );
                    const bits = await window.crypto.subtle.deriveBits({
                        name: 'PBKDF2',
                        salt,
                        iterations: 120000,
                        hash: 'SHA-256'
                    }, key, 256);
                    return {
                        salt: Array.from(salt, byte => byte.toString(16).padStart(2, '0')).join(''),
                        hash: Array.from(new Uint8Array(bits), byte => byte.toString(16).padStart(2, '0')).join('')
                    };
                }

                async function verifyPassphrase(passphrase, record) {
                    if (!window.crypto?.subtle || !record) return false;
                    const salt = Uint8Array.from(record.salt.match(/.{2}/g), byte => parseInt(byte, 16));
                    const key = await window.crypto.subtle.importKey(
                        'raw',
                        new TextEncoder().encode(passphrase),
                        'PBKDF2',
                        false,
                        ['deriveBits']
                    );
                    const bits = await window.crypto.subtle.deriveBits({
                        name: 'PBKDF2',
                        salt,
                        iterations: 120000,
                        hash: 'SHA-256'
                    }, key, 256);
                    const hash = Array.from(new Uint8Array(bits), byte => byte.toString(16).padStart(2, '0')).join('');
                    return hash === record.hash;
                }

                function getEditorAccess() {
                    return JSON.parse(localStorage.getItem(editorAccessKey) || 'null');
                }

                function initEditorAccess() {
                    document.getElementById('setup-admin-btn').addEventListener('click', async () => {
                        const passphrase = document.getElementById('admin-passphrase').value;
                        const confirmation = document.getElementById('admin-passphrase-confirm').value;
                        if (getEditorAccess()?.admin) return setEditorAccessMessage('An admin is already set up.');
                        if (passphrase.length < 10) return setEditorAccessMessage('Use an admin passphrase with at least 10 characters.');
                        if (passphrase !== confirmation) return setEditorAccessMessage('Admin passphrases do not match.');
                        try {
                            localStorage.setItem(editorAccessKey, JSON.stringify({
                                admin: await createPassphraseRecord(passphrase),
                                editor: null
                            }));
                            editorRole = 'admin';
                            renderEditorAccess();
                            renderHymnDetail();
                            setEditorAccessMessage('Local admin set up. You can now grant editor access.');
                        } catch (error) {
                            setEditorAccessMessage(error.message);
                        }
                    });

                    document.getElementById('admin-login-btn').addEventListener('click', async () => {
                        await unlockEditorRole('admin', 'admin-login-passphrase');
                    });
                    document.getElementById('editor-login-btn').addEventListener('click', async () => {
                        await unlockEditorRole('editor', 'editor-login-passphrase');
                    });
                    document.getElementById('grant-editor-btn').addEventListener('click', async () => {
                        if (editorRole !== 'admin') return setEditorAccessMessage('Only the local admin can grant editor access.');
                        const passphrase = document.getElementById('grant-editor-passphrase').value;
                        const confirmation = document.getElementById('grant-editor-passphrase-confirm').value;
                        if (passphrase.length < 10) return setEditorAccessMessage('Use an editor passphrase with at least 10 characters.');
                        if (passphrase !== confirmation) return setEditorAccessMessage('Editor passphrases do not match.');
                        try {
                            const access = getEditorAccess();
                            access.editor = await createPassphraseRecord(passphrase);
                            localStorage.setItem(editorAccessKey, JSON.stringify(access));
                            document.getElementById('grant-editor-passphrase').value = '';
                            document.getElementById('grant-editor-passphrase-confirm').value = '';
                            setEditorAccessMessage('Editor access granted. Share the passphrase in person.');
                        } catch (error) {
                            setEditorAccessMessage(error.message);
                        }
                    });
                    document.getElementById('lock-editor-btn').addEventListener('click', () => {
                        editorRole = null;
                        renderEditorAccess();
                        renderHymnDetail();
                        setEditorAccessMessage('Song editor locked.');
                    });
                    renderEditorAccess();
                }

                async function unlockEditorRole(role, inputId) {
                    const access = getEditorAccess();
                    if (!access || (role === 'editor' && !access.editor)) {
                        setEditorAccessMessage(role === 'editor'
                            ? 'The admin has not granted editor access yet.'
                            : 'Set up a local admin first.');
                        return;
                    }
                    const passphrase = document.getElementById(inputId).value;
                    try {
                        if (!await verifyPassphrase(passphrase, access[role])) {
                            setEditorAccessMessage('Incorrect passphrase.');
                            return;
                        }
                        editorRole = role;
                        document.getElementById(inputId).value = '';
                        renderEditorAccess();
                        renderHymnDetail();
                        setEditorAccessMessage(`Unlocked as ${role}.`);
                    } catch (error) {
                        setEditorAccessMessage(error.message);
                    }
                }

                function renderEditorAccess() {
                    const access = getEditorAccess();
                    document.getElementById('editor-setup-panel').hidden = Boolean(access?.admin);
                    document.getElementById('editor-login-panel').hidden = !access?.admin || Boolean(editorRole);
                    document.getElementById('editor-admin-panel').hidden = editorRole !== 'admin';
                    document.getElementById('editor-unlocked-panel').hidden = !editorRole;
                    document.getElementById('editor-access-status').textContent =
                        editorRole ? `Song editing unlocked as ${editorRole}.` : '';
                }

                function setEditorAccessMessage(message) {
                    document.getElementById('editor-access-message').textContent = message;
                }

        function applyTheme(mode) {
            if (mode === 'dark') {
                document.body.classList.add('dark-mode');
            } else if (mode === 'light') {
                document.body.classList.remove('dark-mode');
            } else {
                // Auto system
                if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                    document.body.classList.add('dark-mode');
                } else {
                    document.body.classList.remove('dark-mode');
                }
            }
        }

        // Font Resizer slider
        const fontSlider = document.getElementById('font-slider');
        const fontSizeVal = document.getElementById('font-size-val');
        fontSlider.addEventListener('input', (e) => {
            const size = e.target.value + 'px';
            fontSizeVal.innerText = size;
            document.getElementById('lyrics-display').style.fontSize = size;
        });

        // ========================================================
        // MOBILE GESTURES: Side-by-Side Swipe Navigation (Songs & Pages)
        // Quits app with message immediately when swiped right at Home
        // ========================================================
        function initMobileGestures() {
            let touchStartX = 0;
            let touchStartY = 0;
            let touchEndX = 0;
            let touchEndY = 0;

            window.addEventListener('touchstart', e => {
                touchStartX = e.changedTouches[0].screenX;
                touchStartY = e.changedTouches[0].screenY;
            }, { passive: true });

            window.addEventListener('touchend', e => {
                touchEndX = e.changedTouches[0].screenX;
                touchEndY = e.changedTouches[0].screenY;
                handleGesture();
            }, { passive: true });

            function handleGesture() {
                const diffX = touchEndX - touchStartX;
                const diffY = touchEndY - touchStartY;
                const minSwipeDistance = 50; // Sensitive for responsive side-by-side swipe

                // Prioritize horizontal side-by-side swipes
                if (Math.abs(diffX) > Math.abs(diffY)) {
                    if (Math.abs(diffX) > minSwipeDistance) {
                        if (diffX < 0) {
                            // Swipe Left -> Next song or Next page
                            navigatePageOrQuit(1);
                        } else {
                            // Swipe Right -> Previous song or Previous page (triggers quit at Home)
                            navigatePageOrQuit(-1);
                        }
                    }
                }
            }
        }

        function showQuitPrompt() {
            const existing = document.getElementById('quit-modal-overlay');
            if (existing) existing.remove();

            const overlay = document.createElement('div');
            overlay.id = 'quit-modal-overlay';
            overlay.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
                z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 1.5rem;
            `;

            overlay.innerHTML = `
                <div style="background: var(--bg-card); border: 1px solid var(--glow-border); border-radius: 16px; padding: 2rem; max-width: 360px; width: 100%; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
                    <div style="font-size: 32px; color: var(--accent); margin-bottom: 12px;"><i class="fas fa-church"></i></div>
                    <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 8px; color: var(--text-main);">Nuer SDA Hymnal</h3>
                    <p style="font-size: 14px; color: var(--text-muted); margin-bottom: 1.5rem;">Do you want to close or exit the worship app? May God bless your day!</p>
                    <div style="display: flex; gap: 10px;">
                        <button id="cancel-quit-btn" style="flex: 1; padding: 10px; border-radius: 9999px; border: 1px solid var(--border-card); background: var(--bg-body); color: var(--text-main); font-weight: 600; cursor: pointer;">Stay</button>
                        <button id="confirm-quit-btn" style="flex: 1; padding: 10px; border-radius: 9999px; border: none; background: var(--danger); color: white; font-weight: 600; cursor: pointer;">Quit App</button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            document.getElementById('cancel-quit-btn').onclick = () => overlay.remove();
            document.getElementById('confirm-quit-btn').onclick = () => {
                overlay.innerHTML = `
                    <div style="background: var(--bg-card); border-radius: 16px; padding: 2rem; max-width: 360px; width: 100%; text-align: center;">
                        <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 8px;">App Closed</h3>
                        <p style="font-size: 13px; color: var(--text-muted);">Thank you for worshipping with Nuer SDA Hymnal. Created by Gatbel Duop Chol.</p>
                    </div>
                `;
                setTimeout(() => {
                    window.close();
                    window.location.href = "about:blank";
                }, 1500);
            };
        }

Object.assign(window, {
    navigateTo,
    switchApp,
    setChurchPresence,
    openHymn,
    toggleFavorite,
    renderSongOfTheDay,
    saveSongEdits,
    saveHymnCategory
});
