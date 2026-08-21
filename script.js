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
        const SPELL_ABILITY_MAP = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

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

        function parseIntSafe(value, fallback = 0) {
            const num = parseInt(value, 10);
            return Number.isNaN(num) ? fallback : num;
        }

        function getDirectChildText(parent, tagName) {
            return parent?.querySelector(`:scope > ${tagName}`)?.textContent.trim() || "";
        }

        function cleanFeatureText(text) {
            return (text || "")
                .replace(/\s*Source:[\s\S]*$/i, "")
                .replace(/\s*[•●▪]\s*/g, " • ")
                .replace(/\s+/g, " ")
                .trim();
        }

        function shouldIncludeFeature(name, text, parentName = "") {
            const normalizedName = (name || "").trim().toLowerCase();
            if (!normalizedName) return false;
            if ([
                "description",
                "origin",
                "suggested characteristics",
                "ability score increase",
                "age",
                "alignment",
                "size",
                "speed",
                "languages"
            ].includes(normalizedName)) return false;
            if (normalizedName === (parentName || "").trim().toLowerCase()) return false;
            if (normalizedName.startsWith("creating ") || normalizedName.startsWith("starting ") || normalizedName.startsWith("multiclass ")) return false;

            const previewText = cleanFeatureText(text).split(/[.!?]/)[0].slice(0, 160);
            return /^feature:/i.test(name) || /\b(you|your|while you|when you|you can|you have|you gain)\b/i.test(previewText);
        }

        function collectActiveFeatures(charNode, classInfos) {
            const activeFeatures = [];
            const addFeaturesFromNode = (parentNode, parentName = "") => {
                if (!parentNode) return;
                parentNode.querySelectorAll(":scope > feat, :scope > feature").forEach(featureNode => {
                    activeFeatures.push({ featureNode, parentName });
                });
            };

            const raceNode = charNode.querySelector("race");
            const backgroundNode = charNode.querySelector("background");
            addFeaturesFromNode(raceNode, getDirectChildText(raceNode, "name"));
            addFeaturesFromNode(backgroundNode, getDirectChildText(backgroundNode, "name"));

            charNode.querySelectorAll(":scope > class").forEach((classNode, index) => {
                const className = getDirectChildText(classNode, "name");
                const classLevel = classInfos[index]?.level || 1;
                addFeaturesFromNode(classNode, className);

                classNode.querySelectorAll(":scope > autolevel").forEach(autolevelNode => {
                    const autolevel = parseIntSafe(getDirectChildText(autolevelNode, "level") || "1", 1);
                    if (autolevel <= classLevel) {
                        addFeaturesFromNode(autolevelNode, className);
                    }
                });
            });

            return activeFeatures;
        }

        function collectAbilityMods(charNode, classInfos) {
            const abilityMods = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
            const applyMod = (modNode) => {
                const category = getDirectChildText(modNode, "category");
                if (category !== "1") return;

                const statIndex = parseIntSafe(getDirectChildText(modNode, "type") || "0", 0);
                const statKey = STATS_MASTER[statIndex];
                const value = parseIntSafe(getDirectChildText(modNode, "value"), 0);

                if (statKey && value) {
                    abilityMods[statKey] += value;
                }
            };

            charNode.querySelectorAll("race > mod, background > mod, class > mod").forEach(applyMod);

            charNode.querySelectorAll(":scope > class").forEach((classNode, index) => {
                const classLevel = classInfos[index]?.level || 1;
                classNode.querySelectorAll(":scope > autolevel").forEach(autolevelNode => {
                    const autolevel = parseIntSafe(getDirectChildText(autolevelNode, "level") || "1", 1);
                    if (autolevel <= classLevel) {
                        autolevelNode.querySelectorAll(":scope > feat > mod, :scope > feature > mod").forEach(applyMod);
                    }
                });
            });

            return abilityMods;
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

                // Class & Levels
                const classNodes = charNode.querySelectorAll("class");
                let totalLevel = 0;
                let hitDiceStr = "";

                // FC5e newer format stores hd as an index (0=d4,1=d6,2=d8,3=d10,4=d12)
                const HD_INDEX_MAP = { "0": "4", "1": "6", "2": "8", "3": "10", "4": "12" };

                const classInfos = [];
                classNodes.forEach(cNode => {
                    const cName = cNode.querySelector(":scope > name")?.textContent.trim() || "";
                    const cLvl = parseInt(cNode.querySelector(":scope > level")?.textContent.trim()) || 0;
                    const rawHd = cNode.querySelector(":scope > hd")?.textContent.trim() || "8";
                    // Map index to die size if needed; otherwise use value directly
                    const cHd = HD_INDEX_MAP[rawHd] || rawHd;
                    if (cName) {
                        classInfos.push({ name: cName, level: cLvl, hd: cHd });
                        totalLevel += cLvl;
                        hitDiceStr += (hitDiceStr ? " + " : "") + `${cLvl || 1}d${cHd}`;
                    }
                });

                // Default to level 1 when no <level> is found in class nodes.
                // Do NOT fall back to getText("level") as that picks up <level> tags
                // inside <autolevel> sub-nodes and returns the wrong value.
                if (totalLevel === 0) totalLevel = 1;
                const classList = classInfos.map(c => `${c.name} ${c.level || (classInfos.length === 1 ? totalLevel : 1)}`);
                document.getElementById('charClass').value = classList.length > 0 ? classList.join(" / ") : "";

                const abilityMods = collectAbilityMods(charNode, classInfos);
                STATS_MASTER.forEach(s => {
                    statsMap[s] += abilityMods[s] || 0;
                    document.getElementById(`score-${s}`).value = statsMap[s];
                    document.getElementById(`mod-${s}`).textContent = calcMod(statsMap[s]);
                });
                const activeFeatures = collectActiveFeatures(charNode, classInfos);

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
                const hpCurrent = getText("hpCurrent") || getText("hp") || hpMax;
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
                    const conMod = Math.floor((statsMap.con - 10) / 2);
                    const hasUnarmoredDefense = activeFeatures.some(({ featureNode }) => getDirectChildText(featureNode, "name") === "Unarmored Defense");
                    acVal = hasUnarmoredDefense ? 10 + dexMod + conMod : 10 + dexMod;
                }
                document.getElementById('acVal').value = acVal;

                // Parse Proficiencies & Skills from XML <proficiency> and <saving-throw> tags.
                // FC5e newer format encodes proficiencies as numeric IDs:
                //   IDs 0-5  → saving throw stat index (0=STR, 1=DEX, 2=CON, 3=INT, 4=WIS, 5=CHA)
                //   IDs 100+ → skill proficiency (ID - 100 = index into SKILLS_MASTER alphabetical list)
                // Older formats use plain text values and are handled as a fallback.
                const profSkillSet = new Set();
                const profSaveSet = new Set();

                charNode.querySelectorAll("proficiency").forEach(p => {
                    const val = p.textContent.trim();
                    const num = parseInt(val);
                    if (!isNaN(num) && String(num) === val) {
                        const skillIdx = num - 100;
                        if (skillIdx >= 0 && skillIdx < SKILLS_MASTER.length) {
                            profSkillSet.add(SKILLS_MASTER[skillIdx].name.toLowerCase());
                        } else if (num >= 0 && num <= 5) {
                            profSaveSet.add(STATS_MASTER[num]);
                        }
                    } else {
                        profSkillSet.add(val.toLowerCase());
                    }
                });

                charNode.querySelectorAll("saving-throw").forEach(p => {
                    profSaveSet.add(p.textContent.trim().toLowerCase());
                });

                // Build a flat text string for legacy callers (passive perception check etc.)
                const profText = Array.from(profSkillSet).join(", ");

                // Initiative
                const dexMod = Math.floor((statsMap.dex - 10) / 2);
                document.getElementById('initVal').value = dexMod >= 0 ? `+${dexMod}` : `${dexMod}`;

                // Hit Dice - built from class hd values
                document.getElementById('hitDice').value = hitDiceStr || `${totalLevel}d8`;

                // Passive Perception - check skill proficiency set
                const wisMod = Math.floor((statsMap.wis - 10) / 2);
                const isPerceptionProf = profSkillSet.has("perception");
                const passivePerc = 10 + wisMod + (isPerceptionProf ? profBonusNum : 0);
                document.getElementById('passivePerception').value = passivePerc;

                // Saving Throws - resolved from profSaveSet (numeric IDs or text values)
                const savesList = [];
                const statNames = { str: ["strength", "str"], dex: ["dexterity", "dex"], con: ["constitution", "con"], int: ["intelligence", "int"], wis: ["wisdom", "wis"], cha: ["charisma", "cha"] };
                STATS_MASTER.forEach(s => {
                    if (profSaveSet.has(s) || Array.from(profSaveSet).some(v => statNames[s]?.includes(v))) {
                        savesList.push(s);
                    }
                });

                renderSaves(savesList, statsMap, profBonusNum);

                // Skills - pass the resolved set of proficient skill names
                renderSkills(profSkillSet, statsMap, profBonusNum);

                // Weapons
                renderWeapons(charNode, statsMap, profBonusNum);

                // Features & Feats (Page 2)
                renderFeatures(activeFeatures);

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

        function renderSkills(profSkillSet, statsMap, profBonus) {
            const container = document.getElementById('skillsList');
            container.innerHTML = '';

            SKILLS_MASTER.forEach(s => {
                const sNameLower = s.name.toLowerCase();
                const isProf = profSkillSet instanceof Set
                    ? profSkillSet.has(sNameLower)
                    : profSkillSet.includes(sNameLower);
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

            if (getDirectChildText(charNode, "unarmed") === "1" && !weapons.some(w => w.name === "Unarmed Strike")) {
                weapons.push({ name: "Unarmed Strike", atkBonus: `+${strMod + profBonus}`, dmg: "1 B" });
            }

            weapons.forEach(w => {
                const tr = document.createElement('tr');
                tr.className = "border-b border-zinc-200";
                const nameCell = document.createElement('td');
                nameCell.className = "p-1 font-bold";
                nameCell.textContent = w.name;

                const atkCell = document.createElement('td');
                atkCell.className = "p-1 font-bold text-center text-red-900";
                atkCell.textContent = w.atkBonus.startsWith('+') || w.atkBonus.startsWith('-') ? w.atkBonus : `+${w.atkBonus}`;

                const dmgCell = document.createElement('td');
                dmgCell.className = "p-1 text-zinc-700";
                dmgCell.textContent = w.dmg;

                tr.append(nameCell, atkCell, dmgCell);
                tbody.appendChild(tr);
            });
        }

        function renderFeatures(activeFeatures) {
            const container = document.getElementById('featuresContainer');
            container.innerHTML = '';
            const seen = new Set();

            activeFeatures.forEach(({ featureNode, parentName }) => {
                if (getDirectChildText(featureNode, "optional") === "1") return;

                const featureName = getDirectChildText(featureNode, "name");
                const featureText = cleanFeatureText(Array.from(featureNode.querySelectorAll(":scope > text")).map(textNode => textNode.textContent.trim()).filter(Boolean).join(" "));
                const featureKey = `${featureName}::${featureText}`;

                if (!shouldIncludeFeature(featureName, featureText, parentName) || seen.has(featureKey)) return;
                seen.add(featureKey);

                const div = document.createElement('div');
                div.className = "border-b border-zinc-200 pb-1.5";

                const nameEl = document.createElement('span');
                nameEl.className = "font-bold text-red-900";
                nameEl.textContent = `${featureName}: `;

                const textEl = document.createElement('span');
                textEl.className = "text-zinc-700";
                textEl.textContent = featureText;

                div.append(nameEl, textEl);
                container.appendChild(div);
            });

            if (container.children.length === 0) {
                container.innerHTML = `<div class="text-zinc-500 italic">No specific class features recorded in export.</div>`;
            }
        }

        function renderEquipment(charNode) {
            const items = [];
            charNode.querySelectorAll("item").forEach(i => {
                const name = i.querySelector("name")?.textContent.trim();
                const qty = i.querySelector("quantity")?.textContent.trim() || i.querySelector("qty")?.textContent.trim() || "1";
                if (name) {
                    const qtyNum = parseInt(qty);
                    if (/gold\s*\(gp\)/i.test(name)) {
                        items.push(`${qtyNum || qty} gp`);
                    } else {
                        items.push(qtyNum > 1 ? `${name} (x${qty})` : name);
                    }
                }
            });

            const moneyValue = parseFloat(getDirectChildText(charNode, "money"));
            if (!Number.isNaN(moneyValue) && !items.some(item => /\bgp\b/i.test(item))) {
                items.push(`${Number.isInteger(moneyValue) ? moneyValue : moneyValue.toFixed(2)} gp`);
            }

            if (items.length > 0) {
                document.getElementById('equipmentList').value = items.join("\n");
            }
        }

        function renderSpells(charNode, statsMap, profBonus) {
            const spells = charNode.querySelectorAll("spell");
            const page3 = document.getElementById('page3');
            const slotValues = (getDirectChildText(charNode, "slots") || "")
                .split(",")
                .map(value => parseIntSafe(value, 0))
                .filter(value => !Number.isNaN(value));
            const hasSpellData = spells.length > 0 || slotValues.some(value => value > 0);

            ['spells0', 'spells1', 'spells2', 'spells3', 'spellsHigher'].forEach(id => {
                document.getElementById(id).innerHTML = '';
            });

            if (!hasSpellData) {
                page3.style.display = "none";
                document.getElementById('spellAbility').value = "";
                document.getElementById('spellSaveDC').value = "";
                document.getElementById('spellAttackBonus').value = "";
                return;
            }

            page3.style.display = "flex";
            const spellAbilityIndex = Array.from(charNode.querySelectorAll(":scope > spellAbility, :scope > class > spellAbility, :scope > race > spellAbility, :scope > background > spellAbility"))
                .map(node => parseIntSafe(node.textContent.trim(), -1))
                .find(index => index >= 0 && index < STATS_MASTER.length);
            const spellAbility = SPELL_ABILITY_MAP[spellAbilityIndex] || "WIS";
            const statKey = STATS_MASTER[spellAbilityIndex] || "wis";
            const spellMod = Math.floor(((statsMap[statKey] || 10) - 10) / 2);

            document.getElementById('spellAbility').value = spellAbility;
            document.getElementById('spellSaveDC').value = 8 + profBonus + spellMod;
            document.getElementById('spellAttackBonus').value = `+${profBonus + spellMod}`;

            spells.forEach(sp => {
                const sName = sp.querySelector("name")?.textContent || "Spell";
                const sLevel = sp.querySelector("level")?.textContent || "0";

                const div = document.createElement('div');
                div.className = "flex items-center justify-between border-b border-zinc-100 py-0.5";

                const textWrap = document.createElement('span');
                const bubble = document.createElement('span');
                bubble.className = "bubble";
                textWrap.append(bubble, document.createTextNode(sName));
                div.appendChild(textWrap);

                if (sLevel === "0") document.getElementById('spells0').appendChild(div);
                else if (sLevel === "1") document.getElementById('spells1').appendChild(div);
                else if (sLevel === "2") document.getElementById('spells2').appendChild(div);
                else if (sLevel === "3") document.getElementById('spells3').appendChild(div);
                else document.getElementById('spellsHigher').appendChild(div);
            });
        }

        function loadSampleCharacter() {
            // Re-runs default state
            showStatus("Loaded default demo sheet.");
        }
