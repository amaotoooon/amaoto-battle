
(function () {
  const ATTACK_VALUES = { punch: 18, kick: 24, throw: 32 };
  const ATTACK_LIMITS = { punch: Infinity, kick: 2, throw: 1 };
  const DEBUFF_SKILLS = new Set(["speech", "prank", "trouble_guard"]);

  function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }
  function canUseSkill(player, skillKey) { return !player.usedSkills.includes(skillKey); }
  function hasAttackUsesLeft(player, move) {
    if (ATTACK_LIMITS[move] === Infinity) return true;
    return (player.attackUsage?.[move] || 0) < ATTACK_LIMITS[move];
  }

  function normalHeal(player, logs) {
    if (player.normalHealUsed >= 2) {
      logs.push(`${player.name}は通常回復をこれ以上使えません。`);
      return { amount: 0, text: "回復失敗" };
    }
    player.normalHealUsed += 1;
    const before = player.hp;
    player.hp = Math.min(100, player.hp + 20);
    const amt = player.hp - before;
    logs.push(`${player.name}は回復（HP＋${amt}）。`);
    return { amount: amt, text: `回復（HP＋${amt}）` };
  }

  function emergencyHeal(player, logs) {
    if (player.emergencyHealUsed) {
      logs.push(`${player.name}は瀕死回復をすでに使っています。`);
      return { amount: 0, text: "瀕死回復失敗" };
    }
    if (player.hp > 15) {
      logs.push(`${player.name}はまだ瀕死回復を使えません。`);
      return { amount: 0, text: "瀕死回復失敗" };
    }
    player.emergencyHealUsed = true;
    const before = player.hp;
    player.hp = Math.max(player.hp, 50);
    const amt = player.hp - before;
    logs.push(`${player.name}は瀕死回復でHPを${amt}回復した。`);
    return { amount: amt, text: `瀕死回復（HP＋${amt}）` };
  }

  function specialEmergencyRevive(defender, logs) {
    if (defender.emergencyHealUsed) return false;
    defender.emergencyHealUsed = true;
    defender.hp = 50;
    logs.push(`${defender.name}の反撃のドラが発動。HPが50まで回復。`);
    return true;
  }

  function randomizeAction(player, originalAction, logs) {
    const pool = [];
    const attacks = ["punch","kick","throw"].filter((m) => hasAttackUsesLeft(player, m));
    attacks.forEach((m)=>pool.push({type:"attack", move:m}));
    pool.push({type:"guard"});
    pool.push({type:"evade"});
    if (player.normalHealUsed < 2) pool.push({type:"heal", mode:"normal"});
    if (player.hp <= 15 && !player.emergencyHealUsed) pool.push({type:"heal", mode:"emergency"});
    if (originalAction && originalAction.type === "skill" && canUseSkill(player, originalAction.skillKey)) {
      pool.push({type:"skill", skillKey: originalAction.skillKey});
    }
    const picked = deepClone(pool[randomInt(0, pool.length - 1)]);
    logs.push(`${player.name}の行動はいたずらでランダムになった。`);
    return picked;
  }

  function preprocessAction(player, opponent, action, logs) {
    let nextAction = action ? deepClone(action) : { type: "guard" };
    if (player.effects.nextActionRandom) {
      nextAction = randomizeAction(player, action, logs);
      player.effects.nextActionRandom = false;
    }
    if (player.effects.blockNextAction || player.effects.blockNextSkill) {
      logs.push(`${player.name}の行動はトラブル回避で無効になった。`);
      player.effects.blockNextAction = false;
      player.effects.blockNextSkill = false;
      return { type: "blocked", blockedAction: nextAction };
    }
    if (nextAction.type === "skill" && opponent.effects.negateNextDebuff && DEBUFF_SKILLS.has(nextAction.skillKey)) {
      logs.push(`${opponent.name}は礼儀・作法で妨害スキルを無効化した。`);
      opponent.effects.negateNextDebuff = false;
      return { type: "guard" };
    }
    if (nextAction.type === "attack" && !hasAttackUsesLeft(player, nextAction.move)) {
      logs.push(`${player.name}は${window.AM.moveLabel(nextAction.move)}をもう使えない。`);
      return { type: "attack", move: "punch" };
    }
    return nextAction;
  }

  function applyDamage(attacker, defender, baseDamage, actionContext, logs) {
    const details = [];
    let damage = baseDamage;
    details.push(`${window.AM.moveLabel(actionContext.move)}（${baseDamage}ダメージ）`);

    if (attacker.effects.nextAttackPenalty > 0) {
      damage = Math.max(0, damage - attacker.effects.nextAttackPenalty);
      details.push(`ダメージ${attacker.effects.nextAttackPenalty}減少（話術の影響）`);
      attacker.effects.nextAttackPenalty = 0;
    }
    if (attacker.effects.nextAttackBonus > 0) {
      damage += attacker.effects.nextAttackBonus;
      details.push(`ダメージ${attacker.effects.nextAttackBonus}増加（強化効果）`);
      attacker.effects.nextAttackBonus = 0;
    }
    if (attacker.effects.attackBuffTurns > 0) {
      damage += 6;
      details.push(`ダメージ6増加（やる気UP）`);
    }

    if (actionContext.defenderAction && actionContext.defenderAction.type === "evade") {
      details.push("回避成功");
      details.push("最終結果：0ダメージ");
      logs.push(`${attacker.name}の${window.AM.moveLabel(actionContext.move)}は${defender.name}に回避された。`);
      return { finalDamage: 0, detailLines: details };
    }

    if (actionContext.defenderAction && actionContext.defenderAction.type === "guard") {
      damage = Math.max(0, damage - 10);
      details.push("ダメージ10軽減（防御）");
    }

    if (defender.effects.nextIncomingAttackNullify) {
      defender.effects.nextIncomingAttackNullify = false;
      details.push("回避成功");
      details.push("最終結果：0ダメージ");
      logs.push(`${defender.name}は攻撃を無効化した。`);
      return { finalDamage: 0, detailLines: details };
    }

    if (defender.shield > 0 && damage > 0) {
      const absorbed = Math.min(defender.shield, damage);
      defender.shield -= absorbed;
      damage -= absorbed;
      if (defender.shield > 0) details.push(`シールド残：${defender.shield}`);
      else if (damage === 0) details.push("シールド相殺");
      else details.push("シールド破壊");
    }

    if (defender.effects.oneShotDamageReduce > 0) {
      damage = Math.max(0, damage - defender.effects.oneShotDamageReduce);
      details.push(`ダメージ${defender.effects.oneShotDamageReduce}軽減（スキル効果）`);
      defender.effects.oneShotDamageReduce = 0;
    }
    if (defender.effects.flexibilityHits > 0) {
      damage = Math.max(0, damage - 6);
      defender.effects.flexibilityHits -= 1;
      details.push("ダメージ6軽減（柔軟性）");
    }

    if (actionContext.defenderAction && actionContext.defenderAction.type === "heal" && actionContext.defenderAction.mode === "emergency" && damage >= defender.hp) {
      specialEmergencyRevive(defender, logs);
      details.push("反撃のドラ発動（HP50まで回復）");
      details.push("最終結果：0ダメージ");
      return { finalDamage: 0, detailLines: details, emergencyTriggered: true };
    }

    defender.hp = Math.max(0, defender.hp - damage);
    details.push(`最終結果：${damage}ダメージ`);
    logs.push(`${attacker.name}の${window.AM.moveLabel(actionContext.move)}。${defender.name}に${damage}ダメージ。`);
    return { finalDamage: damage, detailLines: details };
  }

  function processSkill(caster, target, skillKey, logs, state) {
    const skill = window.AM.findSkill(skillKey);
    if (!skill) return { label: "スキル", detailLines: ["不明なスキル"] };
    const card = window.AM.findCardBySkill(skillKey);
    caster.usedSkills.push(skillKey);
    state.lastAnimations = state.lastAnimations || { p1: null, p2: null };
    state.lastAnimations[caster.role] = {
      playerName: caster.name,
      cardName: card ? card.cardName : skill.skillName,
      skillName: skill.skillName,
      effectShort: skill.effectShort,
      imagePath: card ? card.imagePath : "",
      effectType: skill.effectType || "特殊"
    };
    const detailLines = [];
    const label = `スキル（${skill.skillName}）`;
    switch (skillKey) {
      case "gold_luck":
        caster.effects.goldLuckActive = true;
        detailLines.push("獲得Gアップ待機");
        break;
      case "speech":
        target.effects.nextAttackPenalty += 8;
        detailLines.push("相手の次の攻撃を弱体化");
        break;
      case "charm_up": {
        const before = caster.hp; caster.hp = Math.min(100, caster.hp + 25);
        caster.effects.oneShotDamageReduce += 9999; // treat as nullify? no, too much
        detailLines.push(`回復（HP＋${caster.hp-before})`);
        detailLines.push("次の被ダメージ半減");
        break;
      }
      case "float":
        caster.effects.nextIncomingAttackNullify = true; detailLines.push("次の通常攻撃を無効"); break;
      case "trouble_guard":
        target.effects.blockNextAction = true; target.effects.blockNextSkill = false; detailLines.push("相手の次の行動を無効"); break;
      case "martial_arts":
        caster.effects.nextAttackBonus += 10; detailLines.push("次の攻撃+10"); break;
      case "cooking": {
        const before = caster.hp; caster.hp = Math.min(100, caster.hp + 20);
        detailLines.push(`回復（HP＋${caster.hp-before})`); break;
      }
      case "metabolism":
        caster.effects.regenTurns = Math.max(caster.effects.regenTurns, 3); detailLines.push("3ターン自動回復"); break;
      case "heal": {
        const before = caster.hp; caster.hp = Math.min(100, caster.hp + 35);
        detailLines.push(`回復（HP＋${caster.hp-before})`); break;
      }
      case "wild": {
        const dmg = randomInt(10,24);
        const result=applyDamage(caster,target,dmg,{move:"わんぱく",defenderAction:null},logs);
        detailLines.push(...result.detailLines);
        break;
      }
      case "prank":
        target.effects.nextActionRandom = true; detailLines.push("相手の次ターン行動をランダム化"); break;
      case "kindness": {
        const before = caster.hp; caster.hp = Math.min(100, caster.hp + 15);
        caster.effects.oneShotDamageReduce += 5;
        detailLines.push(`回復（HP＋${caster.hp-before})`);
        detailLines.push("ダメージ5軽減（スキル効果）");
        break;
      }
      case "flexibility":
        caster.effects.flexibilityHits = Math.max(caster.effects.flexibilityHits, 2); detailLines.push("次の2回、ダメージ6軽減"); break;
      case "sharpness":
        caster.effects.nextAttackBonus += 8; detailLines.push("次の攻撃+8"); break;
      case "motivation":
        caster.effects.attackBuffTurns = Math.max(caster.effects.attackBuffTurns, 2); caster.effects.attackBuffPendingStart = true; detailLines.push("2ターン攻撃+6"); break;
      case "stamina":
        caster.shield += 20; detailLines.push(`シールド付与（+20）`); break;
      case "mystic_power": {
        const roll = randomInt(1,4);
        if (roll===1) {
          const result=applyDamage(caster,target,20,{move:"不思議な力",defenderAction:null},logs);
          detailLines.push(...result.detailLines);
        } else if (roll===2) { const before=caster.hp; caster.hp=Math.min(100,caster.hp+20); detailLines.push(`回復（HP＋${caster.hp-before})`);}
        else if (roll===3) { caster.shield +=15; detailLines.push(`シールド付与（+15）`);}
        else { caster.effects.nextAttackBonus +=8; detailLines.push("次の攻撃+8");}
        break;
      }
      case "calm_mind":
        caster.effects.oneShotDamageReduce += 10; detailLines.push("ダメージ10軽減（スキル効果）"); break;
      case "manners": {
        const before=caster.hp; caster.hp=Math.min(100,caster.hp+10); caster.effects.negateNextDebuff = true;
        detailLines.push(`回復（HP＋${caster.hp-before})`); detailLines.push("次の妨害スキルを無効"); break;
      }
      case "explosion": {
        const result=applyDamage(caster,target,40,{move:"？？？",defenderAction:null},logs);
        detailLines.push(...result.detailLines);
        if (Math.random() < 0.5) { caster.hp = Math.max(0, caster.hp - 15); detailLines.push("自分に15ダメージ"); }
        break;
      }
      case "stealth":
        caster.effects.nextIncomingAttackNullify = true; caster.effects.nextAttackBonus += 8;
        detailLines.push("次の攻撃を無効"); detailLines.push("次の攻撃+8"); break;
      default:
        detailLines.push(skill.effectShort);
    }
    logs.push(`${caster.name}は${skill.skillName}を使った。`);
    return { label, detailLines };
  }

  function processAction(actor, target, actorAction, targetAction, logs, state) {
    if (actor.hp <= 0) return { label: "行動不能", detailLines: ["HP0のため行動できない"], hpDelta: 0 };
    switch (actorAction.type) {
      case "attack": {
        actor.attackUsage[actorAction.move] = (actor.attackUsage[actorAction.move] || 0) + 1;
        const result = applyDamage(actor, target, ATTACK_VALUES[actorAction.move] || 0, { move: actorAction.move, defenderAction: targetAction }, logs);
        return { label: `攻撃（${window.AM.moveLabel(actorAction.move)}）`, detailLines: result.detailLines };
      }
      case "blocked": {
        const blockedLabel = actorAction.blockedAction ? window.AM.describeAction(actorAction.blockedAction).replace("瀕死回復","反撃のドラ（瀕死回復）") : "行動";
        logs.push(`${actor.name}の${blockedLabel}はトラブル回避で無効になった。`);
        return { label: "行動無効", detailLines: [`${blockedLabel}はトラブル回避で無効`] };
      }
      case "guard":
        logs.push(`${actor.name}は防御を選択。`);
        return { label: "防御", detailLines: ["ダメージ10軽減（防御）"] };
      case "evade":
        logs.push(`${actor.name}は回避を選択。`);
        return { label: "回避", detailLines: ["相手の通常攻撃を回避待機"] };
      case "heal":
        return { label: actorAction.mode === "emergency" ? "瀕死回復" : "回復", detailLines: [(actorAction.mode === "emergency" ? emergencyHeal(actor, logs) : normalHeal(actor, logs)).text] };
      case "skill":
        if (!canUseSkill(actor, actorAction.skillKey)) return { label: "スキル", detailLines: ["そのスキルはもう使えない"] };
        return processSkill(actor, target, actorAction.skillKey, logs, state);
      default:
        logs.push(`${actor.name}は様子を見ている。`);
        return { label: "待機", detailLines: ["行動なし"] };
    }
  }

  function applyEndTurnEffects(player, logs, lines) {
    if (player.effects.attackBuffTurns > 0) {
      if (player.effects.attackBuffPendingStart) player.effects.attackBuffPendingStart = false;
      else player.effects.attackBuffTurns -= 1;
    }
    if (player.effects.regenTurns > 0 && player.hp > 0) {
      const before = player.hp;
      player.hp = Math.min(100, player.hp + 5);
      player.effects.regenTurns -= 1;
      const amt = player.hp - before;
      if (amt > 0) { logs.push(`${player.name}は自動回復でHPを${amt}回復した。`); lines.push(`回復（HP＋${amt}）`); }
    }
  }

  function awardWinner(state, winnerRole, logs) {
    const p1 = state.players.p1, p2 = state.players.p2;
    const winner = state.players[winnerRole];
    const pot = (p1.bet || 50) + (p2.bet || 50);
    winner.gold += pot;
    if (winner.debt > 0) {
      const repay = Math.min(winner.gold, winner.debt);
      winner.gold -= repay; winner.debt -= repay;
    }
    logs.push(`${winner.name}の勝利。${pot}G獲得。`);
  }

  function determineWinner(state, logs) {
    const p1 = state.players.p1, p2 = state.players.p2;
    if (p1.hp <= 0 && p2.hp <= 0) { state.winner = "draw"; state.phase = "finished"; logs.push("両者戦闘不能。引き分け。"); return; }
    if (p1.hp <= 0) { state.winner = "p2"; state.phase = "finished"; awardWinner(state, "p2", logs); return; }
    if (p2.hp <= 0) { state.winner = "p1"; state.phase = "finished"; awardWinner(state, "p1", logs); return; }
    if (state.turn > 10) {
      state.phase = "finished";
      if (p1.hp === p2.hp) { state.winner = "draw"; logs.push("10ターン終了。同HPのため引き分け。"); }
      else { const winnerRole = p1.hp > p2.hp ? "p1":"p2"; state.winner=winnerRole; logs.push(`10ターン終了。残りHPが多い${state.players[winnerRole].name}の勝ち。`); awardWinner(state, winnerRole, logs); }
    }
  }

  function startMatch(state) {
    const p1 = state.players.p1, p2 = state.players.p2;
    if (!p1.joined || !p2.joined) throw new Error("両プレイヤーの参加登録が必要です。");
    if (!p1.bodyId || !p2.bodyId) throw new Error("両プレイヤーのボディ選択が必要です。");
    if (p1.selectedCards.length !== 3 || p2.selectedCards.length !== 3) throw new Error("両プレイヤーはカードを3枚選ぶ必要があります。");
    ["p1","p2"].forEach((role) => {
      const player = state.players[role];
      player.hp = 100; player.shield = 0; player.usedSkills = []; player.normalHealUsed = 0; player.emergencyHealUsed = false;
      player.submittedAction = null; player.actionLocked = false; player.message = ""; player.effects = window.AM.createEffects(); player.attackUsage = { kick: 0, throw: 0 };
      const available = Math.max(0, Number(player.gold || 0));
      const maxBet = Math.max(50, available);
      const bet = Math.min(Math.max(50, Number(player.bet || 50)), maxBet);
      player.bet = bet;
      const shortage = Math.max(0, bet - available);
      player.debt = shortage;
      player.gold = Math.max(0, available - bet);
    });
    state.turn = 1; state.phase = "battle"; state.winner = null; state.lastAnimations = { p1: null, p2: null };
    state.battleLog = ["対戦開始。ベットをポットに積みました。"]; state.resolvedThisTurn = false; state.turnSummary = null; state.turnResolvedAt = 0;
    state.firstAttackRole = Math.random() < 0.5 ? "p1" : "p2";
    state.resultSummary = null;
    state.matchBet = {
      total: (p1.bet || 50) + (p2.bet || 50),
      p1: { name: p1.name, bet: p1.bet || 50 },
      p2: { name: p2.name, bet: p2.bet || 50 }
    };
    state.betRevealVisible = true;
  }

  function resolveTurn(state) {
    if (state.phase !== "battle") return state;
    const p1 = state.players.p1, p2 = state.players.p2;
    if (!p1.actionLocked || !p2.actionLocked) throw new Error("両プレイヤーの行動確定が必要です。");
    const logs = [`ーーー▼${state.turn}ターン目ーーーーーーーー`, `先攻：${state.players[state.firstAttackRole].name} / 後攻：${state.players[state.firstAttackRole === "p1" ? "p2" : "p1"].name}`, `① ${p1.name}が行動を選択「${window.AM.describeAction(p1.submittedAction)}」`, `② ${p2.name}が行動を選択「${window.AM.describeAction(p2.submittedAction)}」`, `1ターン目の実行結果`];
    state.lastAnimations = { p1: null, p2: null };
    const hpBefore = { p1: p1.hp, p2: p2.hp };
    const action1 = preprocessAction(p1, p2, p1.submittedAction, logs);
    const action2 = preprocessAction(p2, p1, p2.submittedAction, logs);
    const firstRole = state.firstAttackRole || "p1";
    const secondRole = firstRole === "p1" ? "p2" : "p1";
    const first = state.players[firstRole], second = state.players[secondRole];
    const firstAction = firstRole === "p1" ? action1 : action2;
    const secondAction = firstRole === "p1" ? action2 : action1;

    const receivedLines = { p1: [], p2: [] };
    const firstResult = processAction(first, second, firstAction, secondAction, logs, state);
    if (firstAction.type === "attack") receivedLines[secondRole].push(...firstResult.detailLines);
    else receivedLines[firstRole].push(...firstResult.detailLines);
    let secondResult = { label: window.AM.describeAction(secondAction), detailLines: ["行動前に戦闘不能"] };
    if (second.hp > 0) {
      secondResult = processAction(second, first, secondAction, firstAction, logs, state);
      if (secondAction.type === "attack") receivedLines[firstRole].push(...secondResult.detailLines);
      else receivedLines[secondRole].push(...secondResult.detailLines);
    }

    applyEndTurnEffects(p1, logs, receivedLines.p1);
    applyEndTurnEffects(p2, logs, receivedLines.p2);

    p1.submittedAction = null; p2.submittedAction = null; p1.message = ""; p2.message = ""; p1.actionLocked = false; p2.actionLocked = false;
    state.resolvedThisTurn = true;
    state.turnSummary = {
      turn: state.turn,
      firstPlayerRole: firstRole,
      entries: {
        p1: { name: p1.name, choiceLabel: window.AM.describeAction(action1), resultLabel: firstRole === "p1" ? firstResult.label : secondResult.label, detailLines: firstRole === "p1" ? firstResult.detailLines : secondResult.detailLines, receivedLines: receivedLines.p1, hpBefore: hpBefore.p1, hpAfter: p1.hp, shield: p1.shield, ready: p1.actionLocked },
        p2: { name: p2.name, choiceLabel: window.AM.describeAction(action2), resultLabel: firstRole === "p2" ? firstResult.label : secondResult.label, detailLines: firstRole === "p2" ? firstResult.detailLines : secondResult.detailLines, receivedLines: receivedLines.p2, hpBefore: hpBefore.p2, hpAfter: p2.hp, shield: p2.shield, ready: p2.actionLocked }
      }
    };
    state.turnResolvedAt = Date.now();
    determineWinner(state, logs);
    if (state.phase === "finished") {
      const winnerName = state.winner && state.winner !== "draw" ? state.players[state.winner].name : "引き分け";
      state.resultSummary = {
        winnerRole: state.winner,
        winnerName,
        turns: state.turn,
        players: {
          p1: { name: p1.name, damageDealt: Math.max(0, hpBefore.p2 - p2.hp), damageTaken: Math.max(0, hpBefore.p1 - p1.hp), gold: p1.gold, debt: p1.debt },
          p2: { name: p2.name, damageDealt: Math.max(0, hpBefore.p1 - p1.hp), damageTaken: Math.max(0, hpBefore.p2 - p2.hp), gold: p2.gold, debt: p2.debt }
        },
        rewardText: state.winner && state.winner !== "draw" ? `勝利した${winnerName}へ ${(p1.bet||50)+(p2.bet||50)}G` : "引き分け"
      };
    }
    state.turn += 1;
    state.firstAttackRole = secondRole;
    state.battleLog = logs.concat(state.battleLog).slice(0, 120);
    return state;
  }


  function rematch(state) {
    if (state.phase !== "finished") throw new Error("対戦終了後にのみ再戦できます。");
    ["p1", "p2"].forEach((role) => {
      const player = state.players[role];
      const carryGold = Math.max(0, Number(player.gold || 0));
      player.joined = false;
      player.gold = carryGold;
      player.bet = Math.max(50, Number(player.bet || 50));
      player.debt = 0;
      player.hp = 100;
      player.shield = 0;
      player.bodyId = "";
      player.selectedCards = [];
      player.usedSkills = [];
      player.normalHealUsed = 0;
      player.emergencyHealUsed = false;
      player.submittedAction = null;
      player.actionLocked = false;
      player.message = "";
      player.attackUsage = { kick: 0, throw: 0 };
      player.effects = window.AM.createEffects();
    });
    state.phase = "lobby";
    state.turn = 1;
    state.winner = null;
    state.lastAnimation = null;
    state.lastAnimations = { p1: null, p2: null };
    state.resolvedThisTurn = false;
    state.turnSummary = null;
    state.turnResolvedAt = 0;
    state.firstAttackRole = null;
    state.resultSummary = null;
    state.pendingSpectatorRules = false;
    state.rematchToken = (state.rematchToken || 0) + 1;
    state.matchBet = null;
    state.betRevealVisible = false;
    state.battleLog = ["再戦準備に入りました。所持Gを確認し、ボディとスキルを選び直してください。"];
    return state;
  }

  window.AM_BATTLE = { startMatch, resolveTurn, rematch, randomActionFor: randomizeAction };
})();
