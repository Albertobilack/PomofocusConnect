document.addEventListener("DOMContentLoaded", () => {
    const isFirefox = typeof browser !== "undefined";
    const storage = isFirefox ? browser.storage : chrome.storage;

    document.getElementById("getToken").addEventListener("click", () => {
        chrome.cookies.get({ url: "https://pomofocus.io", name: "access_token" }, (cookie) => {
            if (cookie) {
                const userToken = cookie.value;
                document.getElementById("tokenDisplay").textContent = "Token utente: " + userToken;
                const personalName = "yours";
    
                // Funzione per controllare/aggiornare il token personale "yours"
                const updatePersonalToken = (tokens) => {
                    let found = false;
                    for (let i = 0; i < tokens.length; i++) {
                        // Controlla solo in base al valore del token
                        if (tokens[i].token === userToken) {
                            found = true;
                            // Se il token esiste già (anche se con nome diverso), non fare nulla
                            break;
                        }
                        // Se trovi un token con nome "yours" ma il valore è diverso, aggiorna
                        if (tokens[i].name === personalName && tokens[i].token !== userToken) {
                            alert("Il tuo token personale è cambiato, aggiornamento in corso.");
                            tokens[i].token = userToken;
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        tokens.push({ token: userToken, name: personalName });
                    }
                    storage.local.set({ allTokens: tokens });
                };
    
                if (isFirefox) {
                    storage.local.get("allTokens").then((result) => {
                        updatePersonalToken(result.allTokens || []);
                    });
                } else {
                    storage.local.get("allTokens", (result) => {
                        updatePersonalToken(result.allTokens || []);
                    });
                }
    
                storage.local.set({ pomofocusToken: userToken });
            } else {
                document.getElementById("tokenDisplay").textContent = "Token non trovato.";
            }
        });
    });    
    

    document.getElementById("saveToken").addEventListener("click", () => {
        const newToken = document.getElementById("externalToken").value;
        if (!newToken) return alert("Token non valido.");
    
        // Chiedi all'utente di inserire un nome per il token
        const name = prompt("Inserisci un nome per questo token:", "Utente personalizzato");
        if (!name) return alert("Nome non valido.");
    
        const saveToken = (tokens) => {
            // Se il token (valore) è già presente, non aggiungere (incluso se è "yours")
            if (tokens.some(item => item.token === newToken)) {
                document.getElementById("tokenDisplay").textContent = "Token già presente.";
            } else {
                tokens.push({ token: newToken, name });
                storage.local.set({ allTokens: tokens }, () => {
                    document.getElementById("tokenDisplay").textContent = "Token salvato con nome personalizzato.";
                });
            }
        };
    
        if (isFirefox) {
            storage.local.get("allTokens").then((result) => {
                saveToken(result.allTokens || []);
            });
        } else {
            storage.local.get("allTokens", (result) => {
                saveToken(result.allTokens || []);
            });
        }
    });
    
    // Visualizza token salvati
    document.getElementById("viewTokens").addEventListener("click", () => {
        const container = document.getElementById("savedTokensList");
        container.innerHTML = "Caricamento...";

        const render = (tokens) => {
            container.innerHTML = "";

            if (tokens.length === 0) {
                container.innerHTML = "<p>Nessun token salvato.</p>";
                return;
            }

            tokens.forEach((item, index) => {
                const div = document.createElement("div");
                if (item.name === "yours") {
                    // Non mostra il pulsante di eliminazione per il token "yours"
                    div.innerHTML = `${index + 1}. <b>${item.name}</b> (${item.token.slice(0, 10)}...)`;
                } else {
                    div.innerHTML = `${index + 1}. <b>${item.name}</b> (${item.token.slice(0, 10)}...) <button class="deleteBtn" data-index="${index}">❌</button>`;
                }
                container.appendChild(div);
            });

            container.querySelectorAll(".deleteBtn").forEach(button => {
                button.addEventListener("click", (e) => {
                    const index = parseInt(e.target.getAttribute("data-index"));
                    tokens.splice(index, 1);
                    storage.local.set({ allTokens: tokens }, () => {
                        document.getElementById("viewTokens").click();
                    });
                });
            });
        };

        if (isFirefox) {
            storage.local.get("allTokens").then((result) => {
                render(result.allTokens || []);
            });
        } else {
            storage.local.get("allTokens", (result) => {
                render(result.allTokens || []);
            });
        }
    });


    document.getElementById("showStats").addEventListener("click", () => {
        const leaderboardContainer = document.getElementById("statsOutput");
        leaderboardContainer.innerHTML = "Caricamento...";
    
        const processStats = async (tokens) => {
            if (tokens.length === 0) {
                leaderboardContainer.innerHTML = "Nessun token salvato.";
                return;
            }
        
            const today = new Date();
            const todayStr = today.toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric"
            }).replace(/ /g, "-");

            let results = [];

            for (let item of tokens) {
                const name = item.name;
                const token = item.token;
    
                try {
                    const url = "https://pomofocus.io/api/daily-work-minutes";
                    const params = new URLSearchParams({
                        todayStr: todayStr,
                        daysBefore: 7,
                        backCnt: 0
                    });                    
    
                    const fullUrl = `${url}?${params.toString()}`;
    
                    console.log(`[DEBUG] Richiesta GET per "${name}"`);
                    console.log("URL:", fullUrl);
                    console.log("Authorization:", token);
    
                    const response = await fetch(fullUrl, {
                        method: "GET",
                        headers: {
                            Authorization: token
                        }
                    });
    
                    console.log(`[DEBUG] Risposta per "${name}":`);
                    console.log("Status:", response.status);
                    console.log("Headers:", [...response.headers.entries()]);
    
                    const rawText = await response.text();
                    console.log("Raw response body:", rawText);
    
                    let data;
                    try {
                        data = JSON.parse(rawText);
                        console.log("Parsed JSON:", data);
                    } catch (parseErr) {
                        console.error("Errore nel parsing JSON per", name, parseErr);
                        results.push({ name, dailyStats: ["Errore parsing JSON"], error: true });
                        continue;
                    }
    
                    if (Array.isArray(data.reportsResult)) {
                        const dailyStats = data.reportsResult
                            .sort((a, b) => new Date(a.dateStr) - new Date(b.dateStr))
                            .map(entry => {
                                const date = entry.dateStr;
                                const minutes = Math.round(entry.minutes || 0);
                                return `${date} → ${minutes} min`;
                            });
    
                        results.push({ name, dailyStats });
                    } else {
                        results.push({ name, dailyStats: ["Nessun dato disponibile"], error: true });
                    }
    
                } catch (err) {
                    console.error("Errore nella richiesta fetch per", name, err);
                    results.push({ name, dailyStats: ["Errore nella richiesta"], error: true });
                }
            }
    
            leaderboardContainer.innerHTML = "<b>Statistiche dettagliate:</b>\n\n";
            results.forEach((r, i) => {
                leaderboardContainer.innerHTML += `🔸 ${r.name}:\n`;
                r.dailyStats.forEach(line => {
                    leaderboardContainer.innerHTML += `   ${line}\n`;
                });
                leaderboardContainer.innerHTML += `\n`;
            });
        };
    
        if (isFirefox) {
            storage.local.get("allTokens").then((result) => {
                processStats(result.allTokens || []);
            });
        } else {
            storage.local.get("allTokens", (result) => {
                processStats(result.allTokens || []);
            });
        }
    });    
});
