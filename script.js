const SKILLS_MASTER = [
            { name: "Acrobatics", stat: "dex" },
            { name: "Animal Handling", stat: "wis" },
            { name: "Arcana", stat: "int" },
            { name: "Athletics", stat: "str" },
            { name: "Deception", stat: "cha" },
            { name: "History", stat: "int" },
            { name: "Insight", stat: "wis" },
            { name: "Intimidation", stat: "cha" },
            { name: "Investigation", stat: "int" },
            { name: "Medicine", stat: "wis" },
            { name: "Nature", stat: "int" },
            { name: "Perception", stat: "wis" },
            { name: "Performance", stat: "cha" },
            { name: "Persuasion", stat: "cha" },
            { name: "Religion", stat: "int" },
            { name: "Sleight of Hand", stat: "dex" },
            { name: "Stealth", stat: "dex" },
            { name: "Survival", stat: "wis" }
        ];

        const STATS_MASTER = ["str", "dex", "con", "int", "wis", "cha"];

        // Drag and Drop setup
        const dropZone = document.body;
        const fileInput = document.getElementById('xmlFileInput');

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                document.getElementById('fileDropZone').classList.add('drag-over');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                document.getElementById('fileDropZone').classList.remove('drag-over');
            }, false);
        });

        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files.length > 0) processFile(files[0]);
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) processFile(e.target.files[0]);
        });

        document.getElementById('loadSampleBtn').addEventListener('click', loadSampleCharacter);
        document.getElementById('printBtn').addEventListener('click', () => window.print());

        function processFile(file) {
            const reader = new FileReader();
            reader.onload = (e) => parseFC5XML(e.target.result, file.name);
            reader.readAsText(file);
        }

        function showStatus(msg) {
            const statusEl = document.getElementById('statusMessage');
            document.getElementById('statusText').textContent = msg;
            statusEl.classList.remove('hidden');
        }

        function calcMod(score) {
            const num = parseInt(score) || 10;
            const mod = Math.floor((num - 10) / 2);
            return mod >= 0 ? `+${mod}` : `${mod}`;
        }

        function parseFC5XML(xmlText, fileName = "") {
            try {
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlText, "text/xml");

                // FC5 root is <pc version="5"> with <character> inside
                const charNode = xmlDoc.querySelector("character") || xmlDoc.querySelector("pc");
                if (!charNode) {
                    showStatus("Error: XML does not contain a valid Fight Club 5e <pc> or <character> tag.");
                    return;
                }

                // Helper to query text content safely
                const getText = (selector, parent = charNode) => {
                    const el = parent.querySelector(selector);
                    return el ? el.textContent.trim() : "";
                };

                // Name
                const name = getText("name") || "Monty";
                document.getElementById('charName').value = name;
                document.getElementById('p2CharName').textContent = name;
                document.getElementById('p3CharName').textContent = name;

                // Abilities: FC5 stores either as <abilities>16,17,14,13,14,11,</abilities>
                // or as individual tags <str>16</str> <dex>17</dex> etc.
                const abilitiesStr = getText("abilities");
                let statsMap = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

                if (abilitiesStr && abilitiesStr.includes(",")) {
                    const vals = abilitiesStr.split(",").map(v => parseInt(v.trim())).filter(v => !isNaN(v));
                    if (vals.length >= 6) {
                        statsMap = {
                            str: vals[0],
                            dex: vals[1],
                            con: vals[2],
                            int: vals[3],
                            wis: vals[4],
                            cha: vals[5]
                        };
                    }
                } else {
                    // Fallback to explicit tags
                    STATS_MASTER.forEach(s => {
                        const val = parseInt(getText(s));
                        if (!isNaN(val)) statsMap[s] = val;
                    });
                }

                // Update UI Ability Scores & Mods
                STATS_MASTER.forEach(s => {
                    document.getElementById(`score-${s}`).value = statsMap[s];
                    document.getElementById(`mod-${s}`).textContent = calcMod(statsMap[s]);
                });

                // Class & Levels
                const classNodes = charNode.querySelectorAll("class");
                let totalLevel = 0;
                let hitDiceStr = "";

                const classInfos = [];
                classNodes.forEach(cNode => {
                    const cName = cNode.querySelector(":scope > name")?.textContent.trim() || "";
                    const cLvl = parseInt(cNode.querySelector(":scope > level")?.textContent.trim()) || 0;
                    const cHd = cNode.querySelector(":scope > hd")?.textContent.trim() || "8";
                    if (cName) {
                        classInfos.push({ name: cName, level: cLvl, hd: cHd });
                        totalLevel += cLvl;
                        hitDiceStr += (hitDiceStr ? " + " : "") + `${cLvl || 1}d${cHd}`;
                    }
                });

                if (totalLevel === 0) totalLevel = parseInt(getText("level")) || 1;
                const classList = classInfos.map(c => `${c.name} ${c.level || (classInfos.length === 1 ? totalLevel : 1)}`);
                document.getElementById('charClass').value = classList.length > 0 ? classList.join(" / ") : "";

                // Race & Background - use direct child selectors to avoid grabbing character <name>
                const raceNode = charNode.querySelector("race");
                const backgroundNode = charNode.querySelector("background");
                const raceName = raceNode?.querySelector("name")?.textContent.trim() || getText("race") || "";
                document.getElementById('charRace').value = raceName;
                document.getElementById('charBackground').value = backgroundNode?.querySelector("name")?.textContent.trim() || getText("background") || "";

                // Proficiency Bonus based on 5e Level table
                const profBonusNum = Math.floor((totalLevel - 1) / 4) + 2;
                document.getElementById('profBonus').value = `+${profBonusNum}`;

                // HP - FC5 XML uses <hp> for current and <hpmax> for max (lowercase tags)
                const hpMax = getText("hpmax") || getText("hpMax") || "";
                const hpCurrent = getText("hp") || hpMax;
                document.getElementById('hpMax').value = hpMax;
                document.getElementById('hpCurrent').value = hpCurrent;
                document.getElementById('hpTemp').value = getText("hpTemp") || getText("hptemp") || "0";

                // AC & Speed - read speed from race node or top-level
                const speedFromRace = raceNode?.querySelector("speed")?.textContent.trim() || "";
                const speedVal = speedFromRace || getText("speed") || "30";
                document.getElementById('speedVal').value = speedVal.endsWith("ft") ? speedVal : `${speedVal} ft`;

                // Calculate AC from Equipped Items or FC5 tag
                let acVal = getText("ac");
                if (!acVal) {
                    const dexMod = Math.floor((statsMap.dex - 10) / 2);
                    acVal = 10 + dexMod; // Base unarmored
                }
                document.getElementById('acVal').value = acVal;

                // Parse Proficiencies & Skills from XML <proficiency> and <saving-throw> tags
                // Collect all proficiency text from character, class, background, and race nodes
                const allProfTexts = [];
                charNode.querySelectorAll("proficiency").forEach(p => allProfTexts.push(p.textContent.toLowerCase()));
                charNode.querySelectorAll("saving-throw").forEach(p => allProfTexts.push(p.textContent.toLowerCase()));
                const profText = allProfTexts.join(", ");

                // Initiative
                const dexMod = Math.floor((statsMap.dex - 10) / 2);
                document.getElementById('initVal').value = dexMod >= 0 ? `+${dexMod}` : `${dexMod}`;

                // Hit Dice - built from class hd values
                document.getElementById('hitDice').value = hitDiceStr || `${totalLevel}d8`;

                // Passive Perception - check structured proficiency text
                const wisMod = Math.floor((statsMap.wis - 10) / 2);
                const isPerceptionProf = profText.includes("perception");
                const passivePerc = 10 + wisMod + (isPerceptionProf ? profBonusNum : 0);
                document.getElementById('passivePerception').value = passivePerc;

                // Saving Throws - parse from <saving-throw> tags or class <proficiency> for save keywords
                const savesList = [];
                const savingThrowText = charNode.querySelector("saving-throw")?.textContent.toLowerCase() || "";
                // Also look in class proficiency for saving throws
                let allClassProfText = "";
                classNodes.forEach(cNode => {
                    allClassProfText += (cNode.querySelector("proficiency")?.textContent || "") + ",";
                });
                const combinedSaveText = (savingThrowText + "," + allClassProfText).toLowerCase();

                const statNames = { str: ["strength", "str"], dex: ["dexterity", "dex"], con: ["constitution", "con"], int: ["intelligence", "int"], wis: ["wisdom", "wis"], cha: ["charisma", "cha"] };
                STATS_MASTER.forEach(s => {
                    const aliases = statNames[s];
                    if (aliases.some(a => combinedSaveText.includes(a))) {
                        savesList.push(s);
                    }
                });

                renderSaves(savesList, statsMap, profBonusNum);

                // Skills - pass the structured proficiency text
                renderSkills(profText, statsMap, profBonusNum);

                // Weapons
                renderWeapons(charNode, statsMap, profBonusNum);

                // Features & Feats (Page 2)
                renderFeatures(charNode);

                // Equipment
                renderEquipment(charNode);

                // Spells (Page 3)
                renderSpells(charNode, statsMap, profBonusNum);

                showStatus(`Successfully imported character: "${name}" (${document.getElementById('charClass').value})`);

            } catch (err) {
                console.error(err);
                showStatus("Error parsing FC5 XML file. Ensure it is a valid Fight Club 5e export.");
            }
        }

        function renderSaves(savesList, statsMap, profBonus) {
            const container = document.getElementById('savingThrowsList');
            container.innerHTML = '';

            STATS_MASTER.forEach(s => {
                const isProf = savesList.includes(s);
                const statVal = statsMap[s] || 10;
                const mod = Math.floor((statVal - 10) / 2);
                const total = isProf ? mod + profBonus : mod;
                const sign = total >= 0 ? '+' : '';

                const row = document.createElement('div');
                row.className = 'flex items-center justify-between';
                row.innerHTML = `
                    <div class="flex items-center">
                        <span class="bubble ${isProf ? 'filled' : ''}"></span>
                        <span class="font-semibold">${s.toUpperCase()}</span>
                    </div>
                    <span class="font-bold text-red-900">${sign}${total}</span>
                `;
                container.appendChild(row);
            });
        }

        function renderSkills(rawXmlText, statsMap, profBonus) {
            const container = document.getElementById('skillsList');
            container.innerHTML = '';

            SKILLS_MASTER.forEach(s => {
                const sNameLower = s.name.toLowerCase();
                const isProf = rawXmlText.includes(sNameLower);
                const statVal = statsMap[s.stat] || 10;
                const mod = Math.floor((statVal - 10) / 2);
                const total = isProf ? mod + profBonus : mod;
                const sign = total >= 0 ? '+' : '';

                const row = document.createElement('div');
                row.className = 'flex items-center justify-between';
                row.innerHTML = `
                    <div class="flex items-center">
                        <span class="bubble ${isProf ? 'filled' : ''}"></span>
                        <span class="font-medium">${s.name} <span class="text-zinc-400 text-[7.5px]">(${s.stat.toUpperCase()})</span></span>
                    </div>
                    <span class="font-bold text-red-900">${sign}${total}</span>
                `;
                container.appendChild(row);
            });
        }

        function renderWeapons(charNode, statsMap, profBonus) {
            const tbody = document.getElementById('weaponsTable');
            tbody.innerHTML = '';

            const strMod = Math.floor((statsMap.str - 10) / 2);
            const dexMod = Math.floor((statsMap.dex - 10) / 2);

            // FC5 stores weapons either as <weapon> tags or as equipped <item> tags
            const weapons = [];
            
            // Check <weapon> nodes
            charNode.querySelectorAll("weapon").forEach(w => {
                const name = w.querySelector("name")?.textContent || "Weapon";
                const dmg = w.querySelector("damage")?.textContent || "1d6";
                const atkBonus = w.querySelector("attack")?.getAttribute("bonus") || `+${Math.max(strMod, dexMod) + profBonus}`;
                weapons.push({ name, atkBonus, dmg });
            });

            // Check <item> nodes with weapon types or damage
            charNode.querySelectorAll("item").forEach(item => {
                const type = item.querySelector("type")?.textContent;
                const name = item.querySelector("name")?.textContent;
                const dmg = item.querySelector("damage")?.textContent;

                if (name && (type === "M" || type === "R" || type === "W" || dmg)) {
                    const isFinesseOrRanged = type === "R" || name.toLowerCase().includes("bow") || name.toLowerCase().includes("finesse") || name.toLowerCase().includes("scimitar");
                    const mod = isFinesseOrRanged ? dexMod : strMod;
                    const atkBonus = `+${mod + profBonus}`;
                    const dmgText = dmg || (isFinesseOrRanged ? `1d6${mod>=0?'+'+mod:mod}` : `1d8${mod>=0?'+'+mod:mod}`);
                    
                    if (!weapons.some(w => w.name === name)) {
                        weapons.push({ name, atkBonus, dmg: dmgText });
                    }
                }
            });

            // Default fallback if no weapons found in XML
            if (weapons.length === 0) {
                weapons.push({ name: "Longbow", atkBonus: `+${dexMod + profBonus}`, dmg: `1d8+${dexMod} Piercing` });
                weapons.push({ name: "Shortsword", atkBonus: `+${dexMod + profBonus}`, dmg: `1d6+${dexMod} Piercing` });
            }

            weapons.forEach(w => {
                const tr = document.createElement('tr');
                tr.className = "border-b border-zinc-200";
                tr.innerHTML = `
                    <td class="p-1 font-bold">${w.name}</td>
                    <td class="p-1 font-bold text-center text-red-900">${w.atkBonus.startsWith('+')||w.atkBonus.startsWith('-')?w.atkBonus:'+'+w.atkBonus}</td>
                    <td class="p-1 text-zinc-700">${w.dmg}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        function renderFeatures(charNode) {
            const container = document.getElementById('featuresContainer');
            container.innerHTML = '';

            // FC5 XML uses <feature> inside <class>, <race>, and <background> nodes
            charNode.querySelectorAll("class feature, race feature, background feature, feature").forEach(f => {
                const fName = f.querySelector("name")?.textContent.trim();
                const fTextNodes = f.querySelectorAll("text");
                const fText = Array.from(fTextNodes).map(t => t.textContent.trim()).filter(Boolean).join(" ");

                if (fName) {
                    const div = document.createElement('div');
                    div.className = "border-b border-zinc-200 pb-1.5";
                    div.innerHTML = `<span class="font-bold text-red-900">${fName}:</span> <span class="text-zinc-700">${fText}</span>`;
                    container.appendChild(div);
                }
            });

            // Also handle old-style <feat> if present
            charNode.querySelectorAll("feat").forEach(f => {
                const fName = f.querySelector("name")?.textContent.trim();
                const fText = f.querySelector("text")?.textContent.trim();

                if (fName && fText && fName !== "Description") {
                    const div = document.createElement('div');
                    div.className = "border-b border-zinc-200 pb-1.5";
                    div.innerHTML = `<span class="font-bold text-red-900">${fName}:</span> <span class="text-zinc-700">${fText}</span>`;
                    container.appendChild(div);
                }
            });

            if (container.children.length === 0) {
                container.innerHTML = `<div class="text-zinc-500 italic">No specific class features recorded in export.</div>`;
            }
        }

        function renderEquipment(charNode) {
            const items = [];
            charNode.querySelectorAll("item").forEach(i => {
                const name = i.querySelector("name")?.textContent.trim();
                const qty = i.querySelector("qty")?.textContent.trim() || "1";
                if (name) {
                    const qtyNum = parseInt(qty);
                    items.push(qtyNum > 1 ? `${name} (x${qty})` : name);
                }
            });

            if (items.length > 0) {
                document.getElementById('equipmentList').value = items.join("\n");
            }
        }

        function renderSpells(charNode, statsMap, profBonus) {
            const spells = charNode.querySelectorAll("spell");
            const page3 = document.getElementById('page3');

            // Set Spellcasting Ability stats (Default Wisdom for Ranger)
            const wisMod = Math.floor((statsMap.wis - 10) / 2);
            document.getElementById('spellAbility').value = "WIS";
            document.getElementById('spellSaveDC').value = 8 + profBonus + wisMod;
            document.getElementById('spellAttackBonus').value = `+${profBonus + wisMod}`;

            if (spells.length > 0) {
                page3.style.display = "flex";
                ['spells0', 'spells1', 'spells2', 'spells3', 'spellsHigher'].forEach(id => {
                    document.getElementById(id).innerHTML = '';
                });

                spells.forEach(sp => {
                    const sName = sp.querySelector("name")?.textContent || "Spell";
                    const sLevel = sp.querySelector("level")?.textContent || "0";

                    const div = document.createElement('div');
                    div.className = "flex items-center justify-between border-b border-zinc-100 py-0.5";
                    div.innerHTML = `<span><span class="bubble"></span>${sName}</span>`;

                    if (sLevel === "0") document.getElementById('spells0').appendChild(div);
                    else if (sLevel === "1") document.getElementById('spells1').appendChild(div);
                    else if (sLevel === "2") document.getElementById('spells2').appendChild(div);
                    else if (sLevel === "3") document.getElementById('spells3').appendChild(div);
                    else document.getElementById('spellsHigher').appendChild(div);
                });
            } else {
                // If character has no spells, keep page 3 available but clean
                page3.style.display = "flex";
            }
        }

        function loadSampleCharacter() {
            // Re-runs default state
            showStatus("Loaded default demo sheet.");
        }
