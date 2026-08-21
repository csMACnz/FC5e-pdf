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
        document.getElementById('printBtn').addEventListener('click', () => { if (!document.getElementById('printBtn').disabled) window.print(); });

        function processFile(file) {
            const reader = new FileReader();
            reader.onload = (e) => parseFC5XML(e.target.result, file.name);
            reader.readAsText(file);
        }

        function showData() {
            document.getElementById('uploadPlaceholder').classList.add('hidden');
            document.getElementById('sheetsWrapper').classList.remove('hidden');
            document.getElementById('printBtn').disabled = false;
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

        function getDirectChildrenByTag(parent, tagName) {
            if (!parent) return [];
            const target = tagName.toLowerCase();
            return Array.from(parent.children || []).filter(child => (child.tagName || "").toLowerCase() === target);
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

        function collectTrackers(charNode, classInfos) {
            const trackers = [];
            const seen = new Set();
            const addTracker = (trackerNode) => {
                if (!trackerNode) return;
                const label = getDirectChildText(trackerNode, "label");
                if (!label) return;

                const value = getDirectChildText(trackerNode, "value") || getDirectChildText(trackerNode, "formula");
                const max = getDirectChildText(trackerNode, "formula");
                const key = `${label}::${value}::${max}`;
                if (seen.has(key)) return;
                seen.add(key);

                trackers.push({ label, value, max });
            };

            charNode.querySelectorAll(":scope > tracker, :scope > race > tracker, :scope > background > tracker, :scope > class > tracker").forEach(addTracker);

            charNode.querySelectorAll(":scope > class").forEach((classNode, index) => {
                const classLevel = classInfos[index]?.level || 1;
                classNode.querySelectorAll(":scope > autolevel").forEach(autolevelNode => {
                    const autolevel = parseIntSafe(getDirectChildText(autolevelNode, "level") || "1", 1);
                    if (autolevel <= classLevel) {
                        autolevelNode.querySelectorAll(":scope > tracker").forEach(addTracker);
                    }
                });
            });

            return trackers;
        }

        function collectSheetDetails(charNode, activeFeatures) {
            const details = {
                armor: [],
                weapons: [],
                tools: [],
                languages: []
            };
            const seen = {
                armor: new Set(),
                weapons: new Set(),
                tools: new Set(),
                languages: new Set()
            };

            const addUnique = (type, value) => {
                const normalized = (value || "").trim();
                if (!normalized || /^none$/i.test(normalized) || seen[type].has(normalized.toLowerCase())) return;
                seen[type].add(normalized.toLowerCase());
                details[type].push(normalized);
            };

            charNode.querySelectorAll(":scope > class").forEach(classNode => {
                getDirectChildText(classNode, "armor").split(/\s*,\s*/).forEach(value => addUnique("armor", value));
                getDirectChildText(classNode, "weapons").split(/\s*,\s*/).forEach(value => addUnique("weapons", value));
                getDirectChildText(classNode, "tools").split(/\s*,\s*/).forEach(value => addUnique("tools", value));
            });

            charNode.querySelectorAll("race > mod, background > mod, class > mod").forEach(modNode => {
                const name = getDirectChildText(modNode, "name");
                const toolMatch = name.match(/^(.*?)\s*\((Tool Proficiency)\)$/i);
                if (toolMatch) {
                    addUnique("tools", toolMatch[1]);
                }
            });

            activeFeatures
                .filter(({ featureNode }) => getDirectChildText(featureNode, "name").trim().toLowerCase() === "languages")
                .forEach(({ featureNode }) => {
                    const text = cleanFeatureText(Array.from(featureNode.querySelectorAll(":scope > text")).map(textNode => textNode.textContent.trim()).filter(Boolean).join(" "));
                    const match = text.match(/(?:speak,\s*read,\s*and\s*write|speak and understand|speak)\s+([^.!?]+)/i);
                    if (!match) return;

                    match[1]
                        .split(/\s*,\s*|\s+and\s+/i)
                        .map(value => value.replace(/\bcommon\b/i, "Common").trim())
                        .filter(value => value && !/\bchoice\b/i.test(value))
                        .forEach(value => addUnique("languages", value));
                });

            return details;
        }

        function renderSheetDetails(details) {
            const lines = [];
            if (details.armor.length > 0) lines.push(`Armor: ${details.armor.join(", ")}`);
            if (details.weapons.length > 0) lines.push(`Weapons: ${details.weapons.join(", ")}`);
            if (details.tools.length > 0) lines.push(`Tools: ${details.tools.join(", ")}`);
            if (details.languages.length > 0) lines.push(`Languages: ${details.languages.join(", ")}`);
            document.getElementById('profLanguages').value = lines.join("\n");
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
                const trackers = collectTrackers(charNode, classInfos);

                // Race & Background - use direct child selectors to avoid grabbing character <name>
                const raceNode = charNode.querySelector("race");
                const backgroundNode = charNode.querySelector("background");
                const raceName = raceNode?.querySelector("name")?.textContent.trim() || getText("race") || "";
                document.getElementById('charRace').value = raceName;
                document.getElementById('charBackground').value = backgroundNode?.querySelector("name")?.textContent.trim() || getText("background") || "";

                // Proficiency Bonus based on 5e Level table
                const profBonusFromXml = parseIntSafe(getDirectChildText(charNode, "profbonus") || getDirectChildText(charNode, "proficiencyBonus") || getDirectChildText(charNode, "proficiencybonus"), 0);
                const profBonusNum = profBonusFromXml > 0 ? profBonusFromXml : Math.floor((totalLevel - 1) / 4) + 2;
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
                let acVal = parseIntSafe(getDirectChildText(charNode, "ac"), 0);
                if (acVal <= 0) {
                    const dexMod = Math.floor((statsMap.dex - 10) / 2);
                    const itemArmorValues = Array.from(charNode.querySelectorAll(":scope > item"))
                        .map(itemNode => parseIntSafe(getDirectChildText(itemNode, "ac"), -1))
                        .filter(value => value > 0);
                    acVal = itemArmorValues.length > 0 ? Math.max(...itemArmorValues) : 10 + dexMod;
                }
                document.getElementById('acVal').value = acVal;

                // Parse Proficiencies & Skills from XML <proficiency> and <saving-throw> tags.
                // FC5e format encodes skill proficiencies as numeric IDs (0–17) that map directly
                // to the alphabetical SKILLS_MASTER list (0=Acrobatics … 17=Survival).
                // Saving throw proficiencies are stored in separate <saving-throw> tags.
                // Some older exports use plain text skill names and are handled as a fallback.
                const profSkillSet = new Set();
                const profSaveSet = new Set();

                const skillProfNodes = [
                    ...getDirectChildrenByTag(charNode, "proficiency"),
                    ...getDirectChildrenByTag(charNode, "proficiencies").flatMap(node => getDirectChildrenByTag(node, "proficiency"))
                ];
                skillProfNodes.forEach(p => {
                    const val = p.textContent.trim();
                    const num = parseInt(val);
                    if (!isNaN(num) && String(num) === val) {
                        // Direct skill index (0–17)
                        if (num >= 0 && num < SKILLS_MASTER.length) {
                            profSkillSet.add(SKILLS_MASTER[num].name.toLowerCase());
                        } else {
                            // Legacy fallback: some exports used a 100-based offset
                            const skillIdx = num - 100;
                            if (skillIdx >= 0 && skillIdx < SKILLS_MASTER.length) {
                                profSkillSet.add(SKILLS_MASTER[skillIdx].name.toLowerCase());
                            }
                        }
                    } else if (val) {
                        profSkillSet.add(val.toLowerCase());
                    }
                });

                const savingThrowNodes = [
                    ...getDirectChildrenByTag(charNode, "saving-throw"),
                    ...getDirectChildrenByTag(charNode, "saving-throws").flatMap(node => getDirectChildrenByTag(node, "saving-throw")),
                    ...getDirectChildrenByTag(charNode, "savingthrows").flatMap(node => getDirectChildrenByTag(node, "saving-throw"))
                ];
                savingThrowNodes.forEach(p => {
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
                renderFeatures(activeFeatures, trackers);

                // Equipment
                renderEquipment(charNode);

                // Proficiencies & Languages
                renderSheetDetails(collectSheetDetails(charNode, activeFeatures));

                // Spells (Page 3)
                renderSpells(charNode, statsMap, profBonusNum);

                showStatus(`Successfully imported character: "${name}" (${document.getElementById('charClass').value})`);
                showData();

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

            // FC5 stores weapons either as <attack> direct children, <weapon> tags, or equipped <item> tags
            const weapons = [];

            // Check <attack> direct children (primary FC5e format)
            // Each <attack> has <name>, <atk>, and <dmg> children
            charNode.querySelectorAll(":scope > attack").forEach(a => {
                const name = a.querySelector("name")?.textContent.trim() || "Attack";
                const atk = a.querySelector("atk")?.textContent.trim() || `+${Math.max(strMod, dexMod) + profBonus}`;
                const dmg = a.querySelector("dmg")?.textContent.trim() || "1";
                weapons.push({ name, atkBonus: atk, dmg });
            });

            // Check <weapon> nodes (legacy format)
            charNode.querySelectorAll("weapon").forEach(w => {
                const name = w.querySelector("name")?.textContent || "Weapon";
                const dmg = w.querySelector("damage")?.textContent || "1d6";
                const atkBonus = w.querySelector("attack")?.getAttribute("bonus") || `+${Math.max(strMod, dexMod) + profBonus}`;
                if (!weapons.some(x => x.name === name)) {
                    weapons.push({ name, atkBonus, dmg });
                }
            });

            // Check <item> nodes with weapon types or damage
            // FC5e character XML uses numeric type codes: 4=Simple Melee, 5=Martial Melee,
            // 6=Simple Ranged, 7=Martial Ranged. Compendium-sourced items may use letter codes: M, R, W.
            const WEAPON_NUMERIC_TYPES = new Set(["4", "5", "6", "7"]);
            const RANGED_NUMERIC_TYPES = new Set(["6", "7"]);
            charNode.querySelectorAll("item").forEach(item => {
                const type = item.querySelector("type")?.textContent;
                const name = item.querySelector("name")?.textContent;
                const dmg = item.querySelector("damage")?.textContent || item.querySelector("dmg1")?.textContent;

                const isWeaponType = type === "M" || type === "R" || type === "W" || WEAPON_NUMERIC_TYPES.has(type);
                if (name && (isWeaponType || dmg)) {
                    const isFinesseOrRanged = type === "R" || RANGED_NUMERIC_TYPES.has(type) ||
                        name.toLowerCase().includes("bow") || name.toLowerCase().includes("finesse") ||
                        name.toLowerCase().includes("scimitar");
                    const mod = isFinesseOrRanged ? dexMod : strMod;
                    const atkBonus = `+${mod + profBonus}`;
                    const dmgText = dmg || (isFinesseOrRanged ? `1d6${mod>=0?'+'+mod:mod}` : `1d8${mod>=0?'+'+mod:mod}`);

                    if (!weapons.some(w => w.name === name)) {
                        weapons.push({ name, atkBonus, dmg: dmgText });
                    }
                }
            });

            if (getDirectChildText(charNode, "unarmed") === "1" && !weapons.some(w => w.name === "Unarmed Strike")) {
                const unarmedDmg = `1d4${strMod >= 0 ? '+' + strMod : strMod} B`;
                weapons.push({ name: "Unarmed Strike", atkBonus: `+${strMod + profBonus}`, dmg: unarmedDmg });
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

        function renderFeatures(activeFeatures, trackers = []) {
            const container = document.getElementById('featuresContainer');
            container.innerHTML = '';
            const seen = new Set();

            trackers.forEach(({ label, value, max }) => {
                const div = document.createElement('div');
                div.className = "border-b border-zinc-200 pb-1.5";

                const nameEl = document.createElement('span');
                nameEl.className = "font-bold text-red-900";
                nameEl.textContent = `${label}: `;

                const textEl = document.createElement('span');
                textEl.className = "text-zinc-700";
                textEl.textContent = value && max && value !== max ? `${value} / ${max}` : (value || max || "");

                div.append(nameEl, textEl);
                container.appendChild(div);
            });

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
            const name = "Seraphina Dawnveil";
            const statsMap = { str: 8, dex: 14, con: 12, int: 18, wis: 14, cha: 13 };
            const profBonusNum = 3; // level 5
            const totalLevel = 5;

            // Core fields
            document.getElementById('charName').value = name;
            document.getElementById('p2CharName').textContent = name;
            document.getElementById('p3CharName').textContent = name;
            document.getElementById('charClass').value = "Wizard 5";
            document.getElementById('charBackground').value = "Sage";
            document.getElementById('charRace').value = "Half-Elf";
            document.getElementById('charAlignment').value = "Neutral Good";
            document.getElementById('profBonus').value = `+${profBonusNum}`;

            // Ability scores & mods
            STATS_MASTER.forEach(s => {
                document.getElementById(`score-${s}`).value = statsMap[s];
                document.getElementById(`mod-${s}`).textContent = calcMod(statsMap[s]);
            });

            // Combat stats
            document.getElementById('acVal').value = "13";
            document.getElementById('initVal').value = "+2";
            document.getElementById('speedVal').value = "30 ft";
            document.getElementById('hpMax').value = "31";
            document.getElementById('hpCurrent').value = "31";
            document.getElementById('hpTemp').value = "0";
            document.getElementById('hitDice').value = "5d6";
            document.getElementById('passivePerception').value = "14";

            // Saves — INT and WIS proficient
            renderSaves(["int", "wis"], statsMap, profBonusNum);

            // Skills — Arcana, History, Insight, Perception, Investigation proficient
            renderSkills(new Set(["arcana", "history", "insight", "perception", "investigation"]), statsMap, profBonusNum);

            // Weapons
            const tbody = document.getElementById('weaponsTable');
            tbody.innerHTML = '';
            [
                { name: "Quarterstaff", atkBonus: "+2", dmg: "1d6-1 bludgeoning" },
                { name: "Fire Bolt (cantrip)", atkBonus: "+7", dmg: "2d10 fire" },
                { name: "Dagger", atkBonus: "+5", dmg: "1d4+2 piercing" },
            ].forEach(w => {
                const tr = document.createElement('tr');
                tr.className = "border-b border-zinc-200";
                const nameCell = document.createElement('td'); nameCell.className = "p-1 font-bold"; nameCell.textContent = w.name;
                const atkCell = document.createElement('td'); atkCell.className = "p-1 font-bold text-center text-red-900"; atkCell.textContent = w.atkBonus;
                const dmgCell = document.createElement('td'); dmgCell.className = "p-1 text-zinc-700"; dmgCell.textContent = w.dmg;
                tr.append(nameCell, atkCell, dmgCell);
                tbody.appendChild(tr);
            });
            document.getElementById('attackNotes').value = "Arcane Focus (crystal orb) used as spellcasting focus.";

            // Proficiencies & Equipment
            document.getElementById('profLanguages').value = "Armor: None\nWeapons: Daggers, Darts, Slings, Quarterstaffs, Light Crossbows\nLanguages: Common, Elvish, Draconic, Sylvan\nTools: None";
            document.getElementById('equipmentList').value = "Quarterstaff, Crystal Orb (arcane focus), Dagger, Scholar's Pack, Spellbook, 35 gp";

            // Features
            const featuresContainer = document.getElementById('featuresContainer');
            featuresContainer.innerHTML = '';
            [
                { name: "Arcane Recovery", text: "Once per day when you finish a short rest, you can choose expended spell slots to recover. The spell slots can have a combined level equal to or less than half your wizard level (rounded up)." },
                { name: "Spellcasting", text: "INT is your spellcasting ability. Spell save DC 15, Spell attack bonus +7. You can cast spells from your spellbook and prepare INT mod + wizard level spells per day." },
                { name: "School of Evocation: Sculpt Spells", text: "When you cast an evocation spell that affects other creatures, you can protect up to INT mod (4) of them from harm, choosing them to automatically succeed on saving throws and take no damage." },
                { name: "School of Evocation: Potent Cantrip", text: "Starting at 6th level, your damaging cantrips affect even creatures that avoid the brunt of the effect. (Not yet active.)" },
                { name: "Darkvision (Half-Elf)", text: "You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light." },
                { name: "Fey Ancestry", text: "You have advantage on saving throws against being charmed, and magic can't put you to sleep." },
                { name: "Skill Versatility", text: "You gain proficiency in two skills of your choice: Insight and Perception." },
                { name: "Researcher (Sage)", text: "When you attempt to learn or recall a piece of lore, if you don't know the information, you often know where to find it." },
            ].forEach(({ name: fName, text }) => {
                const div = document.createElement('div');
                div.className = "border-b border-zinc-200 pb-1.5";
                const nameEl = document.createElement('span'); nameEl.className = "font-bold text-red-900"; nameEl.textContent = `${fName}: `;
                const textEl = document.createElement('span'); textEl.className = "text-zinc-700"; textEl.textContent = text;
                div.append(nameEl, textEl);
                featuresContainer.appendChild(div);
            });

            // Bio
            document.getElementById('personality').value = "I'm lost in the pages of my spellbook more often than not. Theoretical debates excite me far more than small talk.";
            document.getElementById('ideals').value = "Knowledge. The path to power and self-improvement is through knowledge. (Neutral)";
            document.getElementById('bonds').value = "I am writing a grand treatise on the nature of arcane magic, and I need to finish it before I die.";
            document.getElementById('flaws').value = "I speak without thinking, bluntly stating what others consider uncomfortable truths.";

            // Spells
            document.getElementById('spellAbility').value = "INT";
            document.getElementById('spellSaveDC').value = "15";
            document.getElementById('spellAttackBonus').value = "+7";
            document.getElementById('slots1').textContent = "Slots: [ ] [ ] [ ] [ ]";
            document.getElementById('slots2').textContent = "Slots: [ ] [ ] [ ]";
            document.getElementById('slots3').textContent = "Slots: [ ] [ ]";
            document.getElementById('slots4').textContent = "Slots: (none)";

            [
                { id: 'spells0', spells: ["Fire Bolt", "Mage Hand", "Prestidigitation", "Minor Illusion"] },
                { id: 'spells1', spells: ["Magic Missile", "Shield", "Thunderwave", "Identify", "Detect Magic"] },
                { id: 'spells2', spells: ["Misty Step", "Shatter", "Scorching Ray", "Mirror Image"] },
                { id: 'spells3', spells: ["Fireball", "Counterspell", "Fly"] },
            ].forEach(({ id, spells }) => {
                const container = document.getElementById(id);
                container.innerHTML = '';
                spells.forEach(sName => {
                    const div = document.createElement('div');
                    div.className = "flex items-center justify-between border-b border-zinc-100 py-0.5";
                    const textWrap = document.createElement('span');
                    const bubble = document.createElement('span'); bubble.className = "bubble";
                    textWrap.append(bubble, document.createTextNode(sName));
                    div.appendChild(textWrap);
                    container.appendChild(div);
                });
            });
            document.getElementById('spellsHigher').innerHTML = '';

            showStatus("Loaded demo character: Seraphina Dawnveil (Wizard 5).");
            showData();
        }
