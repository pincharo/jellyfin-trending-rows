(function () {
    "use strict";

    /* ═══════════════════════════════════════════════════════════════
      CONFIG
   ═══════════════════════════════════════════════════════════════ */

    const TRAKT_CLIENT_ID = "YOUR_CLIENT_ID";
    const SHOW_RATING = true;                   // Show the movie's score next to the year
    const SHOW_TRENDING_MOVIES = true;          // Show "Trending Movies" section
    const SHOW_TRENDING_SHOWS = true;          // Show "Trending Shows" section
    const SHOW_PLATFORMS = true;               // Show "Platforms" section
    const SHOW_FRANCHISES = true;              // Show "Franchises" section
    const SHOW_TRENDING_RANK_NUMBERS = true;    // Show the movie's ranking badge
    const LIMIT = 25;                           // How many movies/shows/cards to display (max 50)

    /* ═══════════════════════════════════════════════════════════════
        PLATFORMS — streaming service hubs
        tag must match the Jellyfin tag on your items.
    ═══════════════════════════════════════════════════════════════ */
    const STUDIOS = [
        {
            name: "Apple TV+",
            tag: "Apple TV",
            gradient: "linear-gradient(135deg,#1a1a2e 0%,#0a0a0a 100%)",
            logo: "https://image.tmdb.org/t/p/w780_filter(duotone,ffffff,bababa)/4KAy34EHvRM25Ih8wb82AuGU7zJ.png"
        },
        {
            name: "Disney+",
            tag: "Disney Plus",
            gradient: "linear-gradient(135deg,#0c1b3a 0%,#050d1a 100%)",
            logo: "https://lumiere-a.akamaihd.net/v1/images/a8e5567d1658de062d95d079ebf536b0_4096x2309_6dedcc02.png",
            invert: true
        },
        {
            name: "Prime Video",
            tag: "Amazon Prime Video",
            gradient: "linear-gradient(135deg,#0d1b2a 0%,#010409 100%)",
            logo: "https://image.tmdb.org/t/p/w780_filter(duotone,ffffff,bababa)/ifhbNuuVnlwYy5oXA5VIb2YR8AZ.png"
        },
        {
            name: "Netflix",
            tag: "Netflix",
            gradient: "linear-gradient(135deg,#1a0a0a 0%,#0d0000 100%)",
            logo: "https://image.tmdb.org/t/p/w780_filter(duotone,ffffff,bababa)/wwemzKWzjKYJFfCeiB57q3r4Bcm.png"
        },
        {
            name: "HBO Max",
            tag: "HBO Max",
            gradient: "linear-gradient(135deg,#1a0a2e 0%,#0d0018 100%)",
            logo: "https://image.tmdb.org/t/p/w500_filter(duotone,ffffff,bababa)/nmU0UMDJB3dRRQSTUqawzF2Od1a.png"
        }
    ];

    /* ═══════════════════════════════════════════════════════════════
       FRANCHISES — collection hubs by Jellyfin tag
       tag must match the Jellyfin tag on your items.
    ═══════════════════════════════════════════════════════════════ */
    const FRANCHISES = [
        {
            name: "Marvel",
            tag: "marvel",
            gradient: "linear-gradient(135deg,#1a0a0a 0%,#2a0a0a 50%,#0a0a0a 100%)",
            logo: "https://image.tmdb.org/t/p/w780_filter(duotone,ffffff,bababa)/mIkZDuulwMPzESbzF9lg3rD8CcO.png"
        },
        {
            name: "Star Wars",
            tag: "star wars",
            gradient: "linear-gradient(135deg,#0a0a1a 0%,#1a1a00 50%,#0a0a0a 100%)",
            logo: "https://pngimg.com/d/star_wars_logo_PNG18.png",
            invert: true
        },
        {
            name: "DC Universe",
            tag: "dc universe",
            gradient: "linear-gradient(135deg,#0a1028 0%,#162a50 50%,#0a0a12 100%)",
            logo: "https://image.tmdb.org/t/p/w780_filter(duotone,ffffff,bababa)/2Tc1P3Ac8M479naPp1kYT3izLS5.png",
            big: true
        },
        {
            name: "Pixar",
            tag: "pixar",
            gradient: "linear-gradient(135deg,#0a1525 0%,#0d2540 50%,#0a0a12 100%)",
            logo: "https://image.tmdb.org/t/p/w780_filter(duotone,ffffff,bababa)/1TjvGVDMYsj6JBxOAkUHpPEwLf7.png"
        },
        {
            name: "Harry Potter",
            tag: "harry potter",
            gradient: "linear-gradient(135deg,#1a1420 0%,#0d0a18 50%,#0a0a0a 100%)",
            logo: "https://cdn.freebiesupply.com/images/large/2x/harry-potter-logo-png-transparent.png",
            invert: true
        },
        {
            name: "Harry Potter",
            tag: "harry potter",
            gradient: "linear-gradient(135deg,#1a1420 0%,#0d0a18 50%,#0a0a0a 100%)",
            logo: "https://cdn.freebiesupply.com/images/large/2x/harry-potter-logo-png-transparent.png",
            invert: true
        },
        {
            name: "Harry Potter",
            tag: "harry potter",
            gradient: "linear-gradient(135deg,#1a1420 0%,#0d0a18 50%,#0a0a0a 100%)",
            logo: "https://cdn.freebiesupply.com/images/large/2x/harry-potter-logo-png-transparent.png",
            invert: true
        },
        {
            name: "Harry Potter",
            tag: "harry potter",
            gradient: "linear-gradient(135deg,#1a1420 0%,#0d0a18 50%,#0a0a0a 100%)",
            logo: "https://cdn.freebiesupply.com/images/large/2x/harry-potter-logo-png-transparent.png",
            invert: true
        },
        {
            name: "Harry Potter",
            tag: "harry potter",
            gradient: "linear-gradient(135deg,#1a1420 0%,#0d0a18 50%,#0a0a0a 100%)",
            logo: "https://cdn.freebiesupply.com/images/large/2x/harry-potter-logo-png-transparent.png",
            invert: true
        },
        {
            name: "Harry Potter",
            tag: "harry potter",
            gradient: "linear-gradient(135deg,#1a1420 0%,#0d0a18 50%,#0a0a0a 100%)",
            logo: "https://cdn.freebiesupply.com/images/large/2x/harry-potter-logo-png-transparent.png",
            invert: true
        },
        {
            name: "Harry Potter",
            tag: "harry potter",
            gradient: "linear-gradient(135deg,#1a1420 0%,#0d0a18 50%,#0a0a0a 100%)",
            logo: "https://cdn.freebiesupply.com/images/large/2x/harry-potter-logo-png-transparent.png",
            invert: true
        },
        {
            name: "Harry Potter",
            tag: "harry potter",
            gradient: "linear-gradient(135deg,#1a1420 0%,#0d0a18 50%,#0a0a0a 100%)",
            logo: "https://cdn.freebiesupply.com/images/large/2x/harry-potter-logo-png-transparent.png",
            invert: true
        },
        {
            name: "Harry Potter",
            tag: "harry potter",
            gradient: "linear-gradient(135deg,#1a1420 0%,#0d0a18 50%,#0a0a0a 100%)",
            logo: "https://cdn.freebiesupply.com/images/large/2x/harry-potter-logo-png-transparent.png",
            invert: true
        },
        {
            name: "Harry Potter",
            tag: "harry potter",
            gradient: "linear-gradient(135deg,#1a1420 0%,#0d0a18 50%,#0a0a0a 100%)",
            logo: "https://cdn.freebiesupply.com/images/large/2x/harry-potter-logo-png-transparent.png",
            invert: true
        },
        {
            name: "Harry Potter",
            tag: "harry potter",
            gradient: "linear-gradient(135deg,#1a1420 0%,#0d0a18 50%,#0a0a0a 100%)",
            logo: "https://cdn.freebiesupply.com/images/large/2x/harry-potter-logo-png-transparent.png",
            invert: true
        },
        {
            name: "Pirates of the Caribbean",
            tag: "pirates of the caribbean",
            gradient: "linear-gradient(135deg,#0a1018 0%,#1a1a0a 50%,#0a0a0a 100%)",
            logo: "https://upload.wikimedia.org/wikipedia/commons/5/52/POTC_Logo.png",
            invert: true
        }
    ];

    /* ═══════════════════════════════════════════════════════════════
       CSS
    ═══════════════════════════════════════════════════════════════ */
    function injectCSS() {
        const old = document.getElementById("jfcr-css");
        if (old) old.remove();

        const s = document.createElement("style");
        s.id = "jfcr-css";

        s.textContent = `
            #custom-rows-wrapper {
                display: block;
                margin-bottom: 20px;
            }

            .top10-section {
                margin: 1.4em 0 .6em;

                --itemColumnGap: 14px;
                --cardCount: 8;
                --effectiveWidth: 93.4vw;
                --cardWidth: calc(var(--effectiveWidth) / var(--cardCount) - var(--itemColumnGap));
            }

            /* TRAKT pill */
            .top10-section .top10-pill {
                display: inline-flex;
                align-items: center;
                vertical-align: middle;
                margin-inline-start: .65em !important;
                padding: .25em .75em;
                border-radius: 999px;
                font-size: .55em;
                font-weight: 600;
                letter-spacing: .14em;
                line-height: 1.2;
                background: rgba(255,255,255,.08);
                border: 1px solid rgba(255,255,255,.08);
                color: currentColor !important;
                opacity: .7;
                white-space: nowrap;
                text-decoration: none !important;
            }

            .top10-section .top10-pill:hover,
            .top10-section .top10-pill:focus-visible {
                opacity: 1;
                text-decoration: none !important;
            }

            .top10-section .top10-items {
                gap: var(--itemColumnGap);
            }

            .top10-card {
                flex: 0 0 var(--cardWidth);
                width: var(--cardWidth);
            }

            /* Rank badges  */
            .top10-section .cardIndicators.top10-rank {
                z-index: 4;
            }

            .top10-section .top10-rank-number {
                font-size: 110% !important;
                font-weight: 800 !important;
                text-shadow: 2px 2px 12px rgba(0,0,0,0.33);
            }

            .top10-section .cardIndicators.top10-rank .top10-rank-badge {
                margin: 0 !important;
            }

            /* Change rank colors and opacity here if it conflicts with your theme */
            .top10-section .cardIndicators.top10-rank .top10-rank-badge.top10-rank-gold {
                background-color: rgba(212, 165, 40, .60) !important;
            }

            .top10-section .cardIndicators.top10-rank .top10-rank-badge.top10-rank-silver {
                background-color: rgba(190, 190, 205, .60) !important;
            }

            .top10-section .cardIndicators.top10-rank .top10-rank-badge.top10-rank-bronze {
                background-color: rgba(190, 130, 60, .60) !important;
            }

            .top10-below {
                padding-top: .3em;
            }

            /* Rating next to year */
            .top10-rating {
                display: inline-flex;
                align-items: center;
                gap: 3px;
            }

            .top10-loading,
            .top10-empty {
                padding: 30px 3.3%;
                font-size: .85em;
                opacity: .65;
            }

            .top10-loading {
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .top10-loading::after {
                content: '';
                width: 16px;
                height: 16px;
                border: 2px solid currentColor;
                border-top-color: transparent;
                border-radius: 50%;
                animation: t10sp .8s linear infinite;
            }

            /* Platform / Franchise logo hub rows */
            .hub-section .hub-scroll {
                gap: var(--itemColumnGap, 14px);
            }

            .hub-card {
                flex: 0 0 200px;
                width: 200px;
            }

            .hub-card .cardBox {
                width: 100%;
            }

            .hub-card-scalable {
                position: relative;
            }

            .hub-card-padder {
                padding-bottom: 55%;
            }

            .hub-logo-card {
                position: absolute;
                inset: 0;
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 1.5px solid rgba(255,255,255,.06);
                overflow: hidden;
                cursor: pointer;
            }

            .hub-logo-card::before {
                content: '';
                position: absolute;
                inset: 0;
                background: linear-gradient(135deg, rgba(255,255,255,.04) 0%, transparent 60%);
                pointer-events: none;
            }

            .hub-logo-card img {
                height: 42px;
                max-width: 65%;
                object-fit: contain;
                position: relative;
                z-index: 1;
            }

            .hub-logo-card img.hub-invert {
                filter: brightness(0) invert(1);
                height: 58px;
                max-width: 75%;
            }

            .hub-logo-card img.hub-big {
                height: 55px;
                max-width: 72%;
            }

            .hub-logo-card img.hub-big.hub-invert {
                height: 68px;
                max-width: 80%;
            }

            .hub-card:hover .hub-logo-card,
            .hub-card:focus-visible .hub-logo-card {
                border-color: rgba(255,255,255,.2);
                box-shadow: 0 8px 30px rgba(0,0,0,.5);
            }

            .hub-active-card .hub-logo-card {
                border-color: rgba(255,255,255,.3) !important;
                box-shadow: 0 4px 20px rgba(255,255,255,.06) !important;
            }

            .hub-items-row-empty {
                display: block;
            }

            .hub-items-row-empty .hub-empty {
                padding: 14px 0;
                font-size: .85em;
                opacity: .65;
            }

            .hub-loading {
                padding-top: 14px;
                padding-bottom: 14px;
                font-size: .85em;
                opacity: .65;
            }

            @keyframes t10sp {
                to {
                    transform: rotate(360deg);
                }
            }

            @media (min-width: 901px) {
                .top10-section {
                    --cardCount: 8;
                }
            }

            @media (min-width: 601px) and (max-width: 900px) {
                .top10-section {
                    --cardCount: 6;
                    --itemColumnGap: 12px;
                }
            }

            @media (max-width: 600px) {
                .top10-section {
                    --cardCount: 4;
                    --itemColumnGap: 10px;
                    --effectiveWidth: 92vw;
                }

                .hub-section .hub-scroll {
                    gap: 8px;
                }

                .hub-card {
                    flex-basis: 150px;
                    width: 150px;
                }

                .hub-logo-card {
                    border-radius: 10px;
                }

                .hub-logo-card img {
                    height: 30px;
                    max-width: 60%;
                }

                .hub-logo-card img.hub-invert {
                    height: 42px;
                    max-width: 70%;
                }

                .hub-logo-card img.hub-big {
                    height: 38px;
                }

                .hub-logo-card img.hub-big.hub-invert {
                    height: 48px;
                }
            }
        `;

        document.head.appendChild(s);
    }

    /* ═══════════════════════════════════════════════════════════════
       HELPERS
    ═══════════════════════════════════════════════════════════════ */
    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
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
        } catch {
            return {};
        }
    }

    function forceScrollerRefresh(scroller) {
        if (!scroller) return;

        requestAnimationFrame(() => {
            window.dispatchEvent(new Event("resize"));

            try {
                scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
            } catch { }

            try {
                scroller.classList.remove("hide");
            } catch { }
        });
    }

    function createEmbyScroller(itemsExtraClass = "top10-items") {
        /*
           Jellyfin uses customized built-in elements like:
           <div is="emby-scroller" class="emby-scroller ...">
           This creates that same structure.
        */

        let scroller;

        try {
            scroller = document.createElement("div", { is: "emby-scroller" });
        } catch {
            scroller = document.createElement("div");
        }

        scroller.setAttribute("is", "emby-scroller");
        scroller.className = "emby-scroller padded-top-focusscale padded-bottom-focusscale";
        scroller.setAttribute("data-horizontal", "true");
        scroller.setAttribute("data-mousewheel", "false");
        scroller.setAttribute("data-centerfocus", "card");

        let itemsContainer;

        try {
            itemsContainer = document.createElement("div", { is: "emby-itemscontainer" });
        } catch {
            itemsContainer = document.createElement("div");
        }

        itemsContainer.setAttribute("is", "emby-itemscontainer");
        itemsContainer.className = `itemsContainer scrollSlider focuscontainer-x ${itemsExtraClass}`;

        scroller.appendChild(itemsContainer);

        return {
            scroller,
            itemsContainer
        };
    }

    async function getJellyfinCatalog(type) {
        const { token, userId, base } = gc();

        if (!token || !userId || !base) return [];

        const itemType = type === "movie" ? "Movie" : "Series";
        const url = `${base}/Users/${userId}/Items?IncludeItemTypes=${itemType}&Recursive=true&Fields=ProviderIds,CommunityRating,ProductionYear,OriginalTitle,UserData&ImageTypeLimit=1&EnableImageTypes=Primary`;

        try {
            const r = await fetch(url, {
                headers: {
                    Authorization: `MediaBrowser Token="${token}"`
                }
            });

            if (!r.ok) return [];

            const data = await r.json();
            return data.Items || [];
        } catch {
            return [];
        }
    }

    /* ═══════════════════════════════════════════════════════════════
       TRAKT TRENDING MATCHED AGAINST JELLYFIN LIBRARY
    ═══════════════════════════════════════════════════════════════ */
    async function getTop10(type) {
        const endpoint = type === "movie" ? "movies" : "shows";
        let trending = [];

        try {
            const r = await fetch(`https://api.trakt.tv/${endpoint}/trending?=${LIMIT}`, {
                headers: {
                    "Content-Type": "application/json",
                    "trakt-api-version": "2",
                    "trakt-api-key": TRAKT_CLIENT_ID
                }
            });

            if (r.ok) trending = await r.json();
        } catch {
            return [];
        }

        const catalog = await getJellyfinCatalog(type);
        const idMap = new Map();

        for (const item of catalog) {
            const ids = item.ProviderIds || {};
            const tmdb = ids.Tmdb || ids.TMDb;
            const imdb = ids.Imdb || ids.IMDB || ids.ImdbId;

            if (tmdb) idMap.set("tmdb_" + String(tmdb), item);
            if (imdb) idMap.set("imdb_" + String(imdb), item);
        }

        const results = [];
        const seen = new Set();
        const { base } = gc();

        const fallbackImg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='270'%3E%3Crect width='180' height='270' fill='%23111'/%3E%3C/svg%3E";

        for (const entry of trending) {
            if (results.length >= LIMIT) break;

            const media = type === "movie" ? entry.movie : entry.show;
            if (!media) continue;

            const tmdbId = media.ids?.tmdb?.toString();
            const imdbId = media.ids?.imdb?.toString();

            let match = null;

            if (tmdbId) match = idMap.get("tmdb_" + tmdbId);
            if (!match && imdbId) match = idMap.get("imdb_" + imdbId);

            if (!match) {
                const title = (media.title || "").toLowerCase();

                match = catalog.find(item => {
                    const name = (item.Name || "").toLowerCase();
                    const originalTitle = (item.OriginalTitle || "").toLowerCase();
                    const jellyfinYear = Number(item.ProductionYear || 0);
                    const traktYear = Number(media.year || 0);

                    return (
                        (name === title || originalTitle === title) &&
                        Math.abs(jellyfinYear - traktYear) <= 1
                    );
                });
            }

            if (!match || seen.has(match.Id)) continue;

            seen.add(match.Id);

            const img = match.ImageTags?.Primary
                ? `${base}/Items/${match.Id}/Images/Primary?maxHeight=400&tag=${match.ImageTags.Primary}`
                : fallbackImg;

            const rating = Number(match.CommunityRating);

            results.push({
                name: match.Name || media.title || "Untitled",
                year: match.ProductionYear || media.year || "",
                id: match.Id,
                serverId: match.ServerId,
                rating: Number.isFinite(rating) ? rating.toFixed(1) : null,
                img,
                itemType: type === "movie" ? "Movie" : "Series",
                mediaType: "Video",
                played: !!match.UserData?.Played,
                isFavorite: !!match.UserData?.IsFavorite,
                likes: match.UserData?.Likes ?? ""
            });
        }

        return results;
    }

    /* ═══════════════════════════════════════════════════════════════
       BUILD TRENDING ROW USING EMBY SCROLLER
    ═══════════════════════════════════════════════════════════════ */
    function buildTop10Section(title, type) {
        const section = document.createElement("div");
        section.className = "verticalSection top10-section";

        const titleContainer = document.createElement("div");
        titleContainer.className = "sectionTitleContainer sectionTitleContainer-cards padded-left";

        const titleEl = document.createElement("h2");
        titleEl.className = "sectionTitle sectionTitle-cards";

        const titleText = document.createElement("span");
        titleText.textContent = title;

        const pill = document.createElement("a");
        pill.className = "top10-pill";
        pill.textContent = "TRAKT";
        pill.href = type === "movie"
            ? "https://trakt.tv/movies/trending"
            : "https://trakt.tv/shows/trending";
        pill.target = "_blank";
        pill.rel = "noopener noreferrer";
        pill.title = "Open trending titles on Trakt";
        pill.setAttribute("aria-label", "Open trending titles on Trakt");

        titleEl.append(titleText, pill);
        titleContainer.appendChild(titleEl);
        section.appendChild(titleContainer);

        const loading = document.createElement("div");
        loading.className = "top10-loading";
        loading.textContent = "Matching trending titles against your library…";
        section.appendChild(loading);

        const { scroller, itemsContainer } = createEmbyScroller();
        scroller.style.display = "none";
        section.appendChild(scroller);

        getTop10(type)
            .then(items => {
                loading.remove();
                itemsContainer.innerHTML = "";

                if (!items.length) {
                    const empty = document.createElement("div");
                    empty.className = "top10-empty";
                    empty.textContent = "No matches found in your library";
                    section.appendChild(empty);
                    return;
                }

                scroller.style.display = "";

                items.forEach((it, i) => {
                    const detailsUrl = `#/details?id=${it.id}&serverId=${it.serverId || ""}`;
                    const itemType = it.itemType || "Movie";
                    const played = it.played ? "true" : "false";
                    const isFavorite = it.isFavorite ? "true" : "false";
                    const likes = it.likes === null || it.likes === undefined ? "" : String(it.likes);

                    const card = document.createElement("div");
                    card.className = "top10-card card overflowPortraitCard card-hoverable card-withuserdata";
                    card.tabIndex = 0;
                    card.title = it.name;

                    card.setAttribute("data-index", String(i));
                    card.setAttribute("data-id", it.id);
                    card.setAttribute("data-serverid", it.serverId || "");
                    card.setAttribute("data-type", itemType);
                    card.setAttribute("data-mediatype", "Video");
                    card.setAttribute("data-isfolder", itemType === "Series" ? "true" : "false");
                    card.setAttribute("data-context", "home");

                    const rankNumber = i + 1;

                    let rankTierClass = "top10-rank-default";

                    if (rankNumber === 1) rankTierClass = "top10-rank-gold";
                    else if (rankNumber === 2) rankTierClass = "top10-rank-silver";
                    else if (rankNumber === 3) rankTierClass = "top10-rank-bronze";
                    else if (rankNumber <= 10) rankTierClass = "top10-rank-blue";

                    const rankBadgeClass = `countIndicator indicator top10-rank-badge ${rankTierClass}`;

                    const rankHtml = SHOW_TRENDING_RANK_NUMBERS
                        ? `
        <div class="cardIndicators top10-rank">
            <div class="${rankBadgeClass}">
                <span class="top10-rank-number">${rankNumber}</span>
            </div>
        </div>
    `
                        : "";

                    const ratingHtml = SHOW_RATING && it.rating
                        ? `<span class="top10-rating"><span class="top10-star">★</span>${escapeHtml(it.rating)}</span>`
                        : "";

                    card.innerHTML = `
        <div class="cardBox cardBox-bottompadded">
            <div class="cardScalable top10-card-scalable">
                <div class="cardPadder cardPadder-overflowPortrait"></div>

                <a href="${detailsUrl}"
                class="cardImageContainer coveredImage cardContent itemAction top10-card-image-link"
                data-action="link"
                data-id="${it.id}"
                data-serverid="${it.serverId || ""}"
                data-type="${itemType}"
                data-isfolder="${itemType === "Series" ? "true" : "false"}"
                aria-label="${escapeHtml(it.name)}"
                style="background-image: url('${it.img.replace(/'/g, "\\'")}');"></a>

                ${rankHtml}

                <div class="cardOverlayContainer itemAction" data-action="link">
                    <button is="paper-icon-button-light"
                            type="button"
                            class="cardOverlayButton cardOverlayButton-hover itemAction paper-icon-button-light cardOverlayFab-primary"
                            data-action="resume"
                            title="Play">
                        <span class="material-icons cardOverlayButtonIcon cardOverlayButtonIcon-hover play_arrow" aria-hidden="true"></span>
                    </button>

                    <div class="cardOverlayButton-br flex">
                        <button is="emby-playstatebutton"
                                type="button"
                                data-action="none"
                                class="cardOverlayButton cardOverlayButton-hover itemAction paper-icon-button-light emby-button"
                                data-id="${it.id}"
                                data-serverid="${it.serverId || ""}"
                                data-itemtype="${itemType}"
                                data-played="${played}"
                                title="Mark played">
                            <span class="material-icons cardOverlayButtonIcon cardOverlayButtonIcon-hover check ${it.played ? "playstatebutton-icon-played" : "playstatebutton-icon-unplayed"}" aria-hidden="true"></span>
                        </button>

                        <button is="emby-ratingbutton"
                                type="button"
                                data-action="none"
                                class="cardOverlayButton cardOverlayButton-hover itemAction paper-icon-button-light emby-button"
                                data-id="${it.id}"
                                data-serverid="${it.serverId || ""}"
                                data-itemtype="${itemType}"
                                data-likes="${likes}"
                                data-isfavorite="${isFavorite}"
                                title="Add to favorites">
                            <span class="material-icons cardOverlayButtonIcon cardOverlayButtonIcon-hover favorite" aria-hidden="true"></span>
                        </button>

                        <button is="paper-icon-button-light"
                                type="button"
                                class="cardOverlayButton cardOverlayButton-hover itemAction paper-icon-button-light"
                                data-action="menu"
                                title="More">
                            <span class="material-icons cardOverlayButtonIcon cardOverlayButtonIcon-hover more_vert" aria-hidden="true"></span>
                        </button>
                    </div>
                </div>
            </div>

            <div class="cardText cardTextCentered cardText-first">
                <bdi>
                    <a href="${detailsUrl}"
                    class="itemAction textActionButton emby-button"
                    data-action="link"
                    data-id="${it.id}"
                    data-serverid="${it.serverId || ""}"
                    data-type="${itemType}"
                    data-isfolder="${itemType === "Series" ? "true" : "false"}"
                    title="${escapeHtml(it.name)}">${escapeHtml(it.name)}</a>
                </bdi>
            </div>

            <div class="cardText cardTextCentered cardText-secondary">
                <bdi>
                    <span class="top10-year">${escapeHtml(it.year)}</span>
                    ${ratingHtml}
                </bdi>
            </div>
        </div>
    `;

                    const openDetails = () => {
                        location.hash = `#/details?id=${it.id}&serverId=${it.serverId || ""}`;
                    };

                    card.addEventListener("click", e => {
                        if (e.target.closest(".cardOverlayButton, .itemAction, a")) {
                            return;
                        }

                        openDetails();
                    });

                    card.addEventListener("keydown", e => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openDetails();
                        }
                    });

                    itemsContainer.appendChild(card);
                });

                forceScrollerRefresh(scroller);
            })
            .catch(() => {
                loading.remove();

                const empty = document.createElement("div");
                empty.className = "top10-empty";
                empty.textContent = "Could not load trending items";
                section.appendChild(empty);
            });

        return section;
    }

    /* ═══════════════════════════════════════════════════════════════
   TAG HUB HELPERS — Platforms / Franchises
═══════════════════════════════════════════════════════════════ */
    let currentPlatformOpen = null;
    let currentFranchiseOpen = null;

    function buildNativeSectionTitle(title) {
        const titleContainer = document.createElement("div");
        titleContainer.className = "sectionTitleContainer sectionTitleContainer-cards padded-left";

        const titleEl = document.createElement("h2");
        titleEl.className = "sectionTitle sectionTitle-cards";
        titleEl.textContent = title;

        titleContainer.appendChild(titleEl);
        return titleContainer;
    }

    async function fetchByTag(tag) {
        const { token, userId, base } = gc();

        if (!token || !userId || !base) return [];

        const tags = Array.isArray(tag) ? tag : [tag];
        const allItems = [];
        const seen = new Set();

        try {
            for (const t of tags) {
                const url = `${base}/Users/${userId}/Items?IncludeItemTypes=Movie,Series&Tags=${encodeURIComponent(t)}&Recursive=true&SortBy=PremiereDate&SortOrder=Descending&Limit=${LIMIT}&Fields=PrimaryImageAspectRatio,PremiereDate,ProductionYear&ImageTypeLimit=1&EnableImageTypes=Primary`;

                const r = await fetch(url, {
                    headers: {
                        Authorization: `MediaBrowser Token="${token}"`
                    }
                });

                if (!r.ok) continue;

                const data = await r.json();

                for (const item of data.Items || []) {
                    if (seen.has(item.Id)) continue;

                    seen.add(item.Id);
                    allItems.push(item);
                }
            }

            allItems.sort((a, b) => {
                return new Date(b.PremiereDate || 0) - new Date(a.PremiereDate || 0);
            });

            return allItems;
        } catch {
            return [];
        }
    }

    function buildHubThumbRow(items) {
        const { base } = gc();
        const row = document.createElement("div");
        row.className = "hub-items-row";

        if (!items.length) {
            row.classList.add("padded-left", "padded-right", "hub-items-row-empty");

            const empty = document.createElement("div");
            empty.className = "hub-empty";
            empty.textContent = "No content found";

            row.appendChild(empty);
            return row;
        }

        for (const item of items) {
            const thumb = document.createElement("div");
            thumb.className = "hub-thumb";
            thumb.tabIndex = 0;
            thumb.title = item.Name;

            const src = item.ImageTags?.Primary
                ? `${base}/Items/${item.Id}/Images/Primary?maxHeight=300&tag=${item.ImageTags.Primary}`
                : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='130' height='195'%3E%3Crect fill='%23222' width='130' height='195'/%3E%3C/svg%3E";

            const label = item.Name + (item.ProductionYear ? ` (${item.ProductionYear})` : "");

            thumb.innerHTML = `
            <img src="${src}" alt="${escapeHtml(item.Name)}" loading="lazy">
            <div class="hub-thumb-title">${escapeHtml(label)}</div>
        `;

            const openDetails = () => {
                location.hash = `#/details?id=${item.Id}&serverId=${item.ServerId || ""}`;
            };

            thumb.addEventListener("click", openDetails);
            thumb.addEventListener("keydown", e => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openDetails();
                }
            });

            row.appendChild(thumb);
        }

        return row;
    }

    async function toggleHubSection(entry, cardEl, section, stateKey) {
        const activeClass = "hub-active-card";
        const existing = section.querySelector(".hub-items-row");
        const currentTag = stateKey === "platform" ? currentPlatformOpen : currentFranchiseOpen;

        if (existing && currentTag === entry.tag) {
            existing.remove();
            cardEl.classList.remove(activeClass);

            if (stateKey === "platform") currentPlatformOpen = null;
            else currentFranchiseOpen = null;

            return;
        }

        if (existing) existing.remove();

        section.querySelectorAll("." + activeClass).forEach(card => {
            card.classList.remove(activeClass);
        });

        cardEl.classList.add(activeClass);

        if (stateKey === "platform") currentPlatformOpen = entry.tag;
        else currentFranchiseOpen = entry.tag;

        const loading = document.createElement("div");
        loading.className = "hub-loading padded-left padded-right";
        loading.textContent = "Loading…";
        section.appendChild(loading);

        const items = await fetchByTag(entry.tag);

        loading.remove();
        section.appendChild(buildHubThumbRow(items));
    }

    function buildHubSection(title, entries, stateKey) {
        const section = document.createElement("div");
        section.className = "verticalSection hub-section";

        section.appendChild(buildNativeSectionTitle(title));

        const { scroller, itemsContainer } = createEmbyScroller("hub-scroll");

        for (const entry of entries) {
            const card = document.createElement("div");
            card.className = "hub-card card card-hoverable";
            card.tabIndex = 0;
            card.title = entry.name;

            card.innerHTML = `
                <div class="cardBox">
                    <div class="cardScalable hub-card-scalable">
                        <div class="cardPadder hub-card-padder"></div>

                        <div class="cardContent hub-logo-card" style="background: ${entry.gradient};">
                            <img
                                src="${entry.logo}"
                                alt="${escapeHtml(entry.name)}"
                                class="${entry.invert ? "hub-invert" : ""} ${entry.big ? "hub-big" : ""}"
                                loading="lazy">
                        </div>
                    </div>
                </div>
            `;

            const toggle = () => {
                toggleHubSection(entry, card, section, stateKey);
            };

            card.addEventListener("click", toggle);
            card.addEventListener("keydown", e => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggle();
                }
            });

            itemsContainer.appendChild(card);
        }

        section.appendChild(scroller);

        return section;
    }

    function buildPlatformSection() {
        return buildHubSection("Platforms", STUDIOS, "platform");
    }

    function buildFranchiseSection() {
        return buildHubSection("Franchises", FRANCHISES, "franchise");
    }

    /* ═══════════════════════════════════════════════════════════════
       INJECT INTO JELLYFIN HOME
    ═══════════════════════════════════════════════════════════════ */
    function isHomePage() {
        const hash = window.location.hash || "";
        const path = window.location.pathname || "";

        return (
            hash === "" ||
            hash === "#/home" ||
            hash.includes("home.html") ||
            path.endsWith("/web/") ||
            path.endsWith("/web/index.html")
        );
    }

    function injectUI() {
        if (!isHomePage()) return;

        const existing = document.getElementById("custom-rows-wrapper");
        if (existing) return;

        const container =
            document.querySelector(".sections.homeSectionsContainer") ||
            document.querySelector(".homeSectionsContainer") ||
            document.querySelector(".sections");

        if (!container) return;

        injectCSS();

        const wrapper = document.createElement("div");
        wrapper.id = "custom-rows-wrapper";
        wrapper.className = "verticalSection customTrendingSection";
        wrapper.style.order = "2";

        if (SHOW_PLATFORMS) {
            wrapper.appendChild(buildPlatformSection());
        }

        if (SHOW_FRANCHISES) {
            wrapper.appendChild(buildFranchiseSection());
        }

        if (SHOW_TRENDING_MOVIES) {
            wrapper.appendChild(buildTop10Section("Trending Movies", "movie"));
        }

        if (SHOW_TRENDING_SHOWS) {
            wrapper.appendChild(buildTop10Section("Trending Shows", "tv"));
        }

        if (!wrapper.children.length) return;

        container.appendChild(wrapper);

        setTimeout(() => {
            window.dispatchEvent(new Event("resize"));
        }, 250);
    }

    function removeUIWhenLeavingHome() {
        if (isHomePage()) return;

        const existing = document.getElementById("custom-rows-wrapper");
        if (existing) existing.remove();
    }

    const observer = new MutationObserver(() => {
        injectUI();
        removeUIWhenLeavingHome();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    window.addEventListener("hashchange", () => {
        removeUIWhenLeavingHome();
        setTimeout(injectUI, 250);
    });

    setTimeout(injectUI, 1000);
})();