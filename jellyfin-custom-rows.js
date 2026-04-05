(function () {
    "use strict";

    const TRAKT_CLIENT_ID = "YOUR_TRAKT_CLIENT_ID_HERE";

    const STUDIOS = [
        { name: "Apple TV+", tag: "Apple TV", gradient: "linear-gradient(135deg,#1a1a2e 0%,#0a0a0a 100%)", logo: "https://image.tmdb.org/t/p/w780_filter(duotone,ffffff,bababa)/4KAy34EHvRM25Ih8wb82AuGU7zJ.png" },
        { name: "Disney+", tag: "Disney Plus", gradient: "linear-gradient(135deg,#0c1b3a 0%,#050d1a 100%)", logo: "https://lumiere-a.akamaihd.net/v1/images/a8e5567d1658de062d95d079ebf536b0_4096x2309_6dedcc02.png", invert: true },
        { name: "Prime Video", tag: "Amazon Prime Video", gradient: "linear-gradient(135deg,#0d1b2a 0%,#010409 100%)", logo: "https://image.tmdb.org/t/p/w780_filter(duotone,ffffff,bababa)/ifhbNuuVnlwYy5oXA5VIb2YR8AZ.png" },
        { name: "Netflix", tag: "Netflix", gradient: "linear-gradient(135deg,#1a0a0a 0%,#0d0000 100%)", logo: "https://image.tmdb.org/t/p/w780_filter(duotone,ffffff,bababa)/wwemzKWzjKYJFfCeiB57q3r4Bcm.png" }
    ];

    function injectCSS() {
        if (document.getElementById("jfcr-css")) return;
        const s = document.createElement("style");
        s.id = "jfcr-css";
        s.textContent = `
            #custom-rows-wrapper{display:flex;flex-direction:column;gap:10px;margin-bottom:20px}
            .srow-section{margin:.8em 0 .2em;padding:0 3.3%}
            .srow-title{font-size:1.35em;font-weight:700;color:rgba(255,255,255,.92);margin-bottom:.55em}
            .srow-scroll{display:flex;gap:12px}
            .srow-card{flex:1 1 0;min-width:0;height:110px;border-radius:12px;display:flex;align-items:center;justify-content:center;cursor:pointer;border:1.5px solid rgba(255,255,255,.06);transition:transform .25s cubic-bezier(.22,1,.36,1),border-color .3s,box-shadow .3s;position:relative;overflow:hidden}
            .srow-card::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.04) 0%,transparent 60%);pointer-events:none}
            .srow-card:hover{transform:scale(1.03);border-color:rgba(255,255,255,.2);box-shadow:0 8px 30px rgba(0,0,0,.5)}
            .srow-card:active{transform:scale(.98)}
            .srow-card img{height:42px;max-width:65%;object-fit:contain}
            .srow-card img.srow-invert{filter:brightness(0) invert(1);height:58px;max-width:75%}
            .srow-active-card{border-color:rgba(255,255,255,.3)!important;box-shadow:0 4px 20px rgba(255,255,255,.06)!important}
            .srow-items-row{margin-top:14px;display:flex;gap:10px;overflow-x:auto;padding-bottom:10px;scroll-behavior:smooth;-webkit-overflow-scrolling:touch;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.1) transparent}
            .srow-items-row::-webkit-scrollbar{height:4px}
            .srow-items-row::-webkit-scrollbar-thumb{background:rgba(255,255,255,.12);border-radius:2px}
            .srow-thumb{flex:0 0 auto;width:130px;cursor:pointer;border-radius:8px;overflow:hidden;background:rgba(255,255,255,.03);transition:transform .2s,box-shadow .2s}
            .srow-thumb:hover{transform:translateY(-4px) scale(1.03);box-shadow:0 8px 20px rgba(0,0,0,.5)}
            .srow-thumb img{width:100%;aspect-ratio:2/3;object-fit:cover;display:block;background:#111}
            .srow-thumb-t{padding:5px 7px;font-size:.7em;color:#aaa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
            .srow-loading{color:rgba(255,255,255,.3);padding:20px;font-size:.85em;display:flex;align-items:center;gap:8px}
            .srow-loading::after{content:'';width:14px;height:14px;border:2px solid rgba(255,255,255,.2);border-top-color:#fff;border-radius:50%;animation:srowSp .7s linear infinite}
            @keyframes srowSp{to{transform:rotate(360deg)}}
            .srow-empty{color:rgba(255,255,255,.25);padding:20px;font-size:.8em}
            .top10-section{margin:1.4em 0 .6em;padding:0 3.3%}
            .top10-header{display:flex;align-items:center;gap:10px;margin-bottom:.7em}
            .top10-title{font-size:1.35em;font-weight:700;color:rgba(255,255,255,.92)}
            .top10-pill{background:rgba(255,255,255,.08);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);padding:4px 12px;border-radius:20px;font-size:.65em;font-weight:600;color:rgba(255,255,255,.7);letter-spacing:1.5px;border:1px solid rgba(255,255,255,.08)}
            .top10-scroll{display:flex;gap:14px;overflow-x:auto;padding-bottom:12px;scroll-behavior:smooth;-webkit-overflow-scrolling:touch;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.08) transparent}
            .top10-scroll::-webkit-scrollbar{height:3px}
            .top10-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:2px}
            .top10-card{flex:0 0 auto;width:180px;cursor:pointer;position:relative;border-radius:14px;overflow:hidden;transition:transform .3s cubic-bezier(.22,1,.36,1),box-shadow .3s;border:1px solid rgba(255,255,255,.04)}
            .top10-card:hover{transform:translateY(-6px) scale(1.02);box-shadow:0 12px 40px rgba(0,0,0,.6)}
            .top10-backdrop{width:100%;aspect-ratio:2/3;object-fit:cover;display:block;background:#0a0a0a;transition:transform .4s ease}
            .top10-card:hover .top10-backdrop{transform:scale(1.06)}
            .top10-overlay{position:absolute;inset:0;background:linear-gradient(0deg,rgba(0,0,0,.9) 0%,rgba(0,0,0,.3) 40%,transparent 65%);display:flex;flex-direction:column;justify-content:flex-end;padding:14px 12px}
            .top10-rank{position:absolute;top:0;left:0;width:44px;height:44px;border-radius:0 0 12px 0;background:rgba(0,0,0,.55);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-right:1px solid rgba(255,255,255,.1);border-bottom:1px solid rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;color:rgba(255,255,255,.9);font-family:'Arial Black',Arial,sans-serif}
            .top10-rank-1{background:rgba(212,165,40,.3);color:#f5d560;text-shadow:0 0 12px rgba(245,213,96,.4)}
            .top10-rank-2{background:rgba(180,180,195,.2);color:#d8d8e0;text-shadow:0 0 10px rgba(216,216,224,.3)}
            .top10-rank-3{background:rgba(190,130,60,.25);color:#dda855;text-shadow:0 0 10px rgba(221,168,85,.3)}
            .top10-info{display:flex;flex-direction:column;gap:3px}
            .top10-name{font-size:.78em;font-weight:600;color:#fff;line-height:1.2;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
            .top10-meta{display:flex;align-items:center;gap:6px;font-size:.6em;color:rgba(255,255,255,.45)}
            .top10-year{color:rgba(255,255,255,.5)}
            .top10-rating{display:flex;align-items:center;gap:3px;background:rgba(255,255,255,.08);padding:2px 6px;border-radius:4px;font-weight:600;color:rgba(255,255,255,.65)}
            .top10-star{color:#f0c850;font-size:9px}
            .top10-trending-dot{width:5px;height:5px;border-radius:50%;background:#4cd964;flex-shrink:0}
            .top10-loading{color:rgba(255,255,255,.25);padding:30px 0;font-size:.85em;display:flex;align-items:center;gap:10px}
            .top10-loading::after{content:'';width:16px;height:16px;border:2px solid rgba(255,255,255,.12);border-top-color:rgba(255,255,255,.5);border-radius:50%;animation:t10sp .8s linear infinite}
            @keyframes t10sp{to{transform:rotate(360deg)}}
            .top10-empty{color:rgba(255,255,255,.2);padding:30px 0;font-size:.8em}
            @media(min-width:601px) and (max-width:900px){
                .srow-scroll{display:grid!important;grid-template-columns:1fr 1fr;gap:10px}
                .srow-card{height:95px}.srow-card img{height:36px}.srow-card img.srow-invert{height:48px}
                .top10-card{width:155px}.top10-rank{width:38px;height:38px;font-size:19px}
            }
            @media(max-width:600px){
                .srow-section,.top10-section{padding:0 4%}
                .srow-title,.top10-title{font-size:1.15em;margin-bottom:.4em}
                .srow-scroll{display:grid!important;grid-template-columns:1fr 1fr;gap:8px}
                .srow-card{height:80px;border-radius:10px}.srow-card img{height:30px;max-width:60%}.srow-card img.srow-invert{height:42px;max-width:70%}
                .srow-items-row{gap:8px;margin-top:10px}.srow-thumb{width:105px;border-radius:6px}.srow-thumb-t{font-size:.65em;padding:4px 6px}
                .top10-scroll{gap:10px}.top10-card{width:135px;border-radius:10px}.top10-rank{width:34px;height:34px;font-size:16px;border-radius:0 0 8px 0}
                .top10-overlay{padding:10px 8px}.top10-name{font-size:.65em}.top10-meta{font-size:.5em}
            }
        `;
        document.head.appendChild(s);
    }

    function gc() {
        try {
            const c = JSON.parse(localStorage.getItem("jellyfin_credentials") || "{}");
            const sv = (c.Servers || [])[0] || {};
            return {
                token: sv.AccessToken,
                userId: sv.UserId,
                base: (sv.ManualAddress || sv.LocalAddress || location.origin).replace(/\/+$/, "")
            };
        } catch { return {}; }
    }

    async function getJellyfinCatalog(type) {
        const { token, userId, base } = gc();
        if (!token) return [];
        const itemType = type === "movie" ? "Movie" : "Series";
        const url = `${base}/Users/${userId}/Items?IncludeItemTypes=${itemType}&Recursive=true&Fields=ProviderIds,CommunityRating,ProductionYear,OriginalTitle&ImageTypeLimit=1&EnableImageTypes=Primary`;
        try {
            const r = await fetch(url, { headers: { Authorization: `MediaBrowser Token="${token}"` } });
            return r.ok ? ((await r.json()).Items || []) : [];
        } catch { return []; }
    }

    async function getTop10(type) {
        const endpoint = type === "movie" ? "movies" : "shows";
        let trending = [];
        try {
            const r = await fetch(`https://api.trakt.tv/${endpoint}/trending?limit=50`, {
                headers: {
                    "Content-Type": "application/json",
                    "trakt-api-version": "2",
                    "trakt-api-key": TRAKT_CLIENT_ID
                }
            });
            if (r.ok) trending = await r.json();
        } catch { return []; }

        const catalog = await getJellyfinCatalog(type);

        const idMap = new Map();
        for (const item of catalog) {
            const ids = item.ProviderIds || {};
            const tmdb = ids.Tmdb || ids.TMDb;
            const imdb = ids.Imdb;
            if (tmdb) idMap.set("tmdb_" + tmdb, item);
            if (imdb) idMap.set("imdb_" + imdb, item);
        }

        const results = [];
        const seen = new Set();
        const { base } = gc();
        const fallbackImg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='270'%3E%3Crect width='180' height='270' fill='%23111'/%3E%3C/svg%3E";

        for (const entry of trending) {
            if (results.length >= 10) break;
            const media = type === "movie" ? entry.movie : entry.show;
            if (!media) continue;

            const tmdbId = media.ids?.tmdb?.toString();
            const imdbId = media.ids?.imdb?.toString();

            let match = null;
            if (tmdbId) match = idMap.get("tmdb_" + tmdbId);
            if (!match && imdbId) match = idMap.get("imdb_" + imdbId);

            if (!match) {
                const title = (media.title || "").toLowerCase();
                match = catalog.find(it => {
                    const name = (it.Name || "").toLowerCase();
                    const orig = (it.OriginalTitle || "").toLowerCase();
                    return (name === title || orig === title) && Math.abs((it.ProductionYear || 0) - (media.year || 0)) <= 1;
                });
            }

            if (!match || seen.has(match.Id)) continue;
            seen.add(match.Id);

            const img = match.ImageTags?.Primary
                ? `${base}/Items/${match.Id}/Images/Primary?maxHeight=400&tag=${match.ImageTags.Primary}`
                : fallbackImg;

            results.push({
                name: match.Name,
                year: match.ProductionYear,
                id: match.Id,
                serverId: match.ServerId,
                rating: match.CommunityRating ? match.CommunityRating.toFixed(1) : null,
                img
            });
        }
        return results;
    }

    async function fetchByTag(tag) {
        const { token, userId, base } = gc();
        if (!token || !userId) return [];
        try {
            const url = `${base}/Users/${userId}/Items?IncludeItemTypes=Movie,Series&Tags=${encodeURIComponent(tag)}&Recursive=true&SortBy=PremiereDate&SortOrder=Descending&Limit=50&Fields=PrimaryImageAspectRatio,PremiereDate&ImageTypeLimit=1&EnableImageTypes=Primary`;
            const r = await fetch(url, { headers: { Authorization: `MediaBrowser Token="${token}"` } });
            return r.ok ? (await r.json()).Items || [] : [];
        } catch { return []; }
    }

    let currentOpen = null;

    async function toggleItems(studio, cardEl, container) {
        const existing = container.querySelector(".srow-items-row");
        if (existing && currentOpen === studio.tag) {
            existing.remove();
            cardEl.classList.remove("srow-active-card");
            currentOpen = null;
            return;
        }
        if (existing) existing.remove();
        container.querySelectorAll(".srow-active-card").forEach(c => c.classList.remove("srow-active-card"));
        cardEl.classList.add("srow-active-card");
        currentOpen = studio.tag;

        const row = document.createElement("div");
        row.className = "srow-items-row";
        row.innerHTML = '<div class="srow-loading">Loading</div>';
        container.appendChild(row);

        const items = await fetchByTag(studio.tag);
        row.innerHTML = "";
        if (!items.length) {
            row.innerHTML = `<div class="srow-empty">No content tagged "${studio.tag}"</div>`;
            return;
        }

        const { base } = gc();
        for (const it of items) {
            const thumb = document.createElement("div");
            thumb.className = "srow-thumb";
            const src = it.ImageTags?.Primary
                ? `${base}/Items/${it.Id}/Images/Primary?maxHeight=300&tag=${it.ImageTags.Primary}`
                : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='130' height='195'%3E%3Crect fill='%23222' width='130' height='195'/%3E%3C/svg%3E";
            const label = it.Name + (it.ProductionYear ? ` (${it.ProductionYear})` : "");
            thumb.innerHTML = `<img src="${src}" loading="lazy"><div class="srow-thumb-t">${label}</div>`;
            thumb.onclick = () => { location.hash = `#/details?id=${it.Id}&serverId=${it.ServerId}`; };
            row.appendChild(thumb);
        }
    }

    function buildStudioSection() {
        const section = document.createElement("div");
        section.className = "srow-section";
        const title = document.createElement("h2");
        title.className = "srow-title";
        title.textContent = "Platforms";
        section.appendChild(title);

        const scroll = document.createElement("div");
        scroll.className = "srow-scroll";
        for (const studio of STUDIOS) {
            const card = document.createElement("div");
            card.className = "srow-card";
            card.style.background = studio.gradient;
            card.title = studio.name;
            const img = new Image();
            img.src = studio.logo;
            img.alt = studio.name;
            if (studio.invert) img.classList.add("srow-invert");
            card.appendChild(img);
            card.onclick = () => toggleItems(studio, card, section);
            scroll.appendChild(card);
        }
        section.appendChild(scroll);
        return section;
    }

    function buildTop10Section(title, type) {
        const section = document.createElement("div");
        section.className = "top10-section";

        const header = document.createElement("div");
        header.className = "top10-header";
        const titleEl = document.createElement("span");
        titleEl.className = "top10-title";
        titleEl.textContent = title;
        const pill = document.createElement("span");
        pill.className = "top10-pill";
        pill.textContent = "TRAKT TRENDING";
        header.append(titleEl, pill);
        section.appendChild(header);

        const scroll = document.createElement("div");
        scroll.className = "top10-scroll";
        scroll.innerHTML = '<div class="top10-loading">Matching trending titles against your library…</div>';
        section.appendChild(scroll);

        getTop10(type).then(items => {
            scroll.innerHTML = "";
            if (!items.length) {
                scroll.innerHTML = '<div class="top10-empty">No matches found in your library</div>';
                return;
            }
            items.forEach((it, i) => {
                const card = document.createElement("div");
                card.className = "top10-card";
                let rankClass = "top10-rank";
                if (i === 0) rankClass += " top10-rank-1";
                else if (i === 1) rankClass += " top10-rank-2";
                else if (i === 2) rankClass += " top10-rank-3";
                const ratingHtml = it.rating
                    ? `<span class="top10-rating"><span class="top10-star">★</span>${it.rating}</span>`
                    : "";
                card.innerHTML = `
                    <img class="top10-backdrop" src="${it.img}" loading="lazy">
                    <div class="top10-overlay">
                        <div class="${rankClass}">${i + 1}</div>
                        <div class="top10-info">
                            <div class="top10-name">${it.name}</div>
                            <div class="top10-meta">
                                <span class="top10-trending-dot"></span>
                                <span class="top10-year">${it.year || ""}</span>
                                ${ratingHtml}
                            </div>
                        </div>
                    </div>`;
                card.onclick = () => { location.hash = `#/details?id=${it.id}&serverId=${it.serverId}`; };
                scroll.appendChild(card);
            });
        });
        return section;
    }

    function injectUI() {
        if (document.getElementById("custom-rows-wrapper")) return;
        const anchor = document.querySelector("iframe.spotlightiframe")
            || document.querySelector(".spotlightiframe")
            || document.querySelector(".section0")
            || document.querySelector(".homeSection:first-child");
        if (!anchor?.parentElement) return;

        injectCSS();
        const wrapper = document.createElement("div");
        wrapper.id = "custom-rows-wrapper";
        wrapper.appendChild(buildStudioSection());
        wrapper.appendChild(buildTop10Section("Movies", "movie"));
        wrapper.appendChild(buildTop10Section("Series", "tv"));
        anchor.parentElement.insertBefore(wrapper, anchor.nextSibling);
    }

    const observer = new MutationObserver(() => {
        const hash = window.location.hash || window.location.pathname;
        if (hash === "" || hash === "/" || hash.includes("home.html") || hash === "#/home") {
            injectUI();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(injectUI, 1000);
})();
