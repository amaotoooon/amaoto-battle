(function () {
  const ATTACK_VALUES = { punch: [18, 22], kick: [24, 24], throw: [32, 32] };
  const ATTACK_LIMITS = { punch: Infinity, kick: 2, throw: 1 };

  function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }
  function circledTurn(n) { return window.AM && window.AM.circledTurn ? window.AM.circledTurn(n) : String(n); }
  function canUseSkill(player, skillKey) { return !player.usedSkills.includes(skillKey); }
  function hasAttackUsesLeft(player, move) {
    if (ATTACK_LIMITS[move] === Infinity) return true;
    return (player.attackUsage?.[move] || 0) < ATTACK_LIMITS[move];
  }
  function isEffectActive(e, turnsKey, pendingKey) {
    return (e[turnsKey] || 0) > 0 && !e[pendingKey];
  }
  function advanceTurnEffect(e, turnsKey, pendingKey, resetFn) {
    if ((e[turnsKey] || 0) <= 0) return;
    if (e[pendingKey]) e[pendingKey] = false;
    else {
      e[turnsKey] -= 1;
      if (e[turnsKey] <= 0 && resetFn) resetFn();
    }
  }
  function moveBaseDamage(move) {
    const entry = ATTACK_VALUES[move] || [0, 0];
    return randomInt(entry[0], entry[1]);
  }
  function skillDisplay(skillKey) {
    const skill = window.AM.findSkill(skillKey);
    return `${skill ? skill.skillName : skillKey}(スキル)`;
  }
  function selectedActionLabel(action) {
    if (!action) return '未入力';
    if (action.type === 'attack') return `攻撃(${window.AM.moveLabel(action.move)})`;
    if (action.type === 'guard') return '防御';
    if (action.type === 'evade') return '回避';
    if (action.type === 'heal') return action.mode === 'emergency' ? '反撃のドラ' : '回復';
    if (action.type === 'skill') return skillDisplay(action.skillKey);
    if (action.type === 'nullified-skill') return 'スキル無効';
    return window.AM.describeAction(action);
  }
  function selectedActionLogLabel(action) {
    if (!action) return '未入力';
    if (action.type === 'attack') return `icon_attack.png 攻撃(${window.AM.moveLabel(action.move)})`;
    if (action.type === 'guard') return 'icon_shield.png 防御';
    if (action.type === 'evade') return 'icon_shield.png 回避';
    if (action.type === 'heal') return action.mode === 'emergency' ? 'hi_01.png 反撃のドラ' : 'icon_potion.png 回復';
    if (action.type === 'skill') return `icon_book.png ${skillDisplay(action.skillKey)}`;
    if (action.type === 'nullified-skill') return 'icon_book.png スキル無効';
    return window.AM.describeAction(action);
  }
  function normalActionLabel(action, value) {
    if (!action) return '未入力';
    if (action.type === 'attack') return `攻撃(${window.AM.moveLabel(action.move)})：${value}ダメージ`;
    if (action.type === 'guard') return '防御(ダメージ10軽減)';
    if (action.type === 'evade') return '回避(50%で無効化)';
    if (action.type === 'heal') return action.mode === 'emergency' ? '反撃のドラ' : '回復(HP20回復)';
    if (action.type === 'skill') return skillDisplay(action.skillKey);
    return selectedActionLabel(action);
  }
  function formatSummaryHpLine(player, before, after, note, extra) {
    return `${player.name}：HP${before}→${after}(${note})${extra ? ` {継続効果：${extra}}` : ''}`;
  }
  function currentEffectsSummary(player) {
    const e = player.effects || {};
    const list = [];
    if (isEffectActive(e, 'regenTurns', 'regenPendingStart')) list.push(`代謝向上(残${e.regenTurns}ターン)`);
    if (isEffectActive(e, 'attackBuffTurns', 'attackBuffPendingStart')) list.push(`やる気UP(残${e.attackBuffTurns}ターン)`);
    if (isEffectActive(e, 'nextAttackBonusTurns', 'nextAttackBonusPendingStart') && e.nextAttackBonus > 0) list.push(`攻撃+${e.nextAttackBonus}(残${e.nextAttackBonusTurns}ターン)`);
    if (isEffectActive(e, 'nextAttackPenaltyTurns', 'nextAttackPenaltyPendingStart') && e.nextAttackPenalty > 0) list.push(`攻撃-${e.nextAttackPenalty}(残${e.nextAttackPenaltyTurns}ターン)`);
    if (isEffectActive(e, 'nextIncomingAttackNullify', 'nextIncomingAttackNullifyPendingStart')) list.push(`攻撃無効(残${e.nextIncomingAttackNullify}ターン)`);
    if (isEffectActive(e, 'halfDamageTurns', 'halfDamagePendingStart')) list.push(`半減(残${e.halfDamageTurns}ターン)`);
    if (isEffectActive(e, 'damageReduceTurns', 'damageReducePendingStart') && e.damageReduceValue > 0) list.push(`被ダメ-${e.damageReduceValue}(残${e.damageReduceTurns}ターン)`);
    if (isEffectActive(e, 'nextActionRandom', 'nextActionRandomPendingStart')) list.push(`いたずら(残${e.nextActionRandom}ターン)`);
    if (isEffectActive(e, 'negateNextSkill', 'negateNextSkillPendingStart')) list.push(`礼儀・作法(残${e.negateNextSkill}ターン)`);
    return list.join(' / ');
  }
  function canUseEmergency(player) {
    return !player.emergencyHealUsed && player.hp <= 15;
  }
  function countSkillUses(player) {
    return Array.isArray(player.usedSkills) ? player.usedSkills.length : 0;
  }
  function dragonState(player) {
    if (player.emergencyHealUsed) return '使用済';
    if (player.hp <= 15) return '発動可';
    return '未解放';
  }
  function randomizeAction(player, originalAction) {
    const pool = [];
    ['punch', 'kick', 'throw'].filter((m) => hasAttackUsesLeft(player, m)).forEach((m) => pool.push({ type: 'attack', move: m }));
    pool.push({ type: 'guard' });
    pool.push({ type: 'evade' });
    if (player.normalHealUsed < 1) pool.push({ type: 'heal', mode: 'normal' });
    if (canUseEmergency(player)) pool.push({ type: 'heal', mode: 'emergency' });
    const availableSkills = (player.selectedCards || []).map((cardId) => window.AM.findCard(cardId)).filter(Boolean).filter((card) => canUseSkill(player, card.skillKey));
    availableSkills.forEach((card) => pool.push({ type: 'skill', skillKey: card.skillKey }));
    if (!pool.length) return originalAction || { type: 'guard' };
    return deepClone(pool[randomInt(0, pool.length - 1)]);
  }

  function applyStartOfActionEffects(player, currentTurn, lines) {
    const e = player.effects || {};
    if (isEffectActive(e, 'regenTurns', 'regenPendingStart') && e.regenLastAppliedTurn !== currentTurn && player.hp > 0) {
      const before = player.hp;
      player.hp = Math.min(100, player.hp + 5);
      e.regenLastAppliedTurn = currentTurn;
      const healed = player.hp - before;
      if (healed > 0) lines.push(`${player.name}は「代謝向上」の効果でHPを${healed}回復した！`);
    }
  }

  function preprocessAction(player, opponent, action, currentTurn, lines) {
    let nextAction = action ? deepClone(action) : { type: 'guard' };
    const e = player.effects || {};
    if (isEffectActive(e, 'nextActionRandom', 'nextActionRandomPendingStart')) {
      lines.push(`${player.name}の行動は${opponent.name}が前ターンで発動した「いたずら」によって無効化された！`);
      nextAction = randomizeAction(player, nextAction);
      const forcedLabel = nextAction.type === 'attack' ? normalActionLabel(nextAction, moveBaseDamage(nextAction.move)) : selectedActionLabel(nextAction);
      lines.push(`${player.name}は「${forcedLabel}」を強制発動！`);
    }
    if (nextAction.type === 'skill' && isEffectActive(opponent.effects, 'negateNextSkill', 'negateNextSkillPendingStart')) {
      lines.push(`${player.name}のスキル発動は${opponent.name}が前ターンで発動した「礼儀・作法」によって無効化された！`);
      return { type: 'nullified-skill', skillKey: nextAction.skillKey };
    }
    if (nextAction.type === 'attack' && !hasAttackUsesLeft(player, nextAction.move)) {
      nextAction = { type: 'attack', move: 'punch' };
    }
    return nextAction;
  }

  function computeAttackDamage(attacker, defender, attackAction, defenderAction, currentTurn, detailLines) {
    const eA = attacker.effects || {};
    const eD = defender.effects || {};
    const baseDamage = moveBaseDamage(attackAction.move);
    let damage = baseDamage;

    if (isEffectActive(eA, 'nextAttackPenaltyTurns', 'nextAttackPenaltyPendingStart') && eA.nextAttackPenalty > 0) {
      damage = Math.max(0, damage - eA.nextAttackPenalty);
      detailLines.push(`${attacker.name}は「話術」の効果で攻撃ダメージが${eA.nextAttackPenalty}下がった！`);
    }
    if (isEffectActive(eA, 'nextAttackBonusTurns', 'nextAttackBonusPendingStart') && eA.nextAttackBonus > 0) {
      damage += eA.nextAttackBonus;
      detailLines.push(`${attacker.name}は攻撃ダメージが${eA.nextAttackBonus}上がった！`);
    }
    if (isEffectActive(eA, 'attackBuffTurns', 'attackBuffPendingStart')) {
      damage += 6;
      detailLines.push(`${attacker.name}は「やる気UP」の効果で攻撃ダメージが6上がった！`);
    }

    if (defenderAction && defenderAction.type === 'heal' && defenderAction.mode === 'emergency' && canUseEmergency(defender)) {
      defender.emergencyHealUsed = true;
      defender.hp = 50;
      return { preventedByDragon: true, baseDamage, finalDamage: 0 };
    }

    if (defenderAction && defenderAction.type === 'evade') {
      if (Math.random() < 0.5) {
        detailLines.push(`${defender.name}は攻撃の回避に成功した！`);
        return { evaded: true, baseDamage, finalDamage: 0 };
      }
      detailLines.push(`しかし${defender.name}は攻撃の回避に失敗した！`);
    }

    if (isEffectActive(eD, 'nextIncomingAttackNullify', 'nextIncomingAttackNullifyPendingStart')) {
      detailLines.push(`${defender.name}は攻撃ダメージを無効化した！`);
      return { nullified: true, baseDamage, finalDamage: 0 };
    }

    if (isEffectActive(eD, 'halfDamageTurns', 'halfDamagePendingStart')) {
      damage = Math.floor(damage / 2);
      detailLines.push(`${defender.name}は「魅力UP」の効果で受けるダメージが半減した！`);
    }
    if (isEffectActive(eD, 'damageReduceTurns', 'damageReducePendingStart') && eD.damageReduceValue > 0) {
      damage = Math.max(0, damage - eD.damageReduceValue);
      detailLines.push(`${defender.name}はダメージを${eD.damageReduceValue}軽減した！`);
    }
    if (defenderAction && defenderAction.type === 'guard') {
      damage = Math.max(0, damage - 10);
      detailLines.push(`${defender.name}は防御によってダメージを10軽減した！`);
    }

    if (defender.shield > 0 && damage > 0) {
      const beforeShield = defender.shield;
      const absorbed = Math.min(defender.shield, damage);
      defender.shield -= absorbed;
      damage -= absorbed;
      detailLines.push(`${defender.name}のシールドが${absorbed}ダメージを防いだ！(残り${defender.shield})`);
      if (beforeShield > 0 && defender.shield === 0) detailLines.push(`${defender.name}のシールドが破壊された！(ﾊﾞﾘﾝっ！)`);
    }

    defender.hp = Math.max(0, defender.hp - damage);
    attacker.cumulativeDamageDealt += damage;
    defender.cumulativeDamageTaken += damage;
    return { baseDamage, finalDamage: damage };
  }

  function applyScheduledSkill(actor, target, skillKey, currentTurn, lines, state) {
    const skill = window.AM.findSkill(skillKey);
    const card = window.AM.findCardBySkill(skillKey);
    actor.usedSkills.push(skillKey);
    state.lastAnimations = state.lastAnimations || { p1: null, p2: null };
    state.lastAnimations[actor.role] = {
      playerName: actor.name,
      cardName: card ? card.cardName : skill?.skillName || skillKey,
      skillName: skill?.skillName || skillKey,
      effectShort: skill?.effectShort || '',
      imagePath: card ? card.imagePath : '',
      effectType: skill?.effectType || '特殊'
    };

    switch (skillKey) {
      case 'gold_luck':
        actor.effects.goldLuckActive = true;
        lines.push(`${actor.name}はこの試合で勝利した場合、獲得Gがアップする！`);
        break;
      case 'speech':
        target.effects.nextAttackPenalty = 8;
        target.effects.nextAttackPenaltyTurns = 1;
        target.effects.nextAttackPenaltyPendingStart = true;
        lines.push(`${actor.name}は次ターン、${target.name}の攻撃ダメージを8下げる！`);
        break;
      case 'charm_up': {
        const before = actor.hp;
        actor.hp = Math.min(100, actor.hp + 25);
        actor.effects.halfDamageTurns = 1;
        actor.effects.halfDamagePendingStart = true;
        lines.push(`${actor.name}はHPを${actor.hp - before}回復した！`);
        lines.push(`${actor.name}は次ターン、受けるダメージが半減する！`);
        break;
      }
      case 'float':
        actor.effects.nextIncomingAttackNullify = 1;
        actor.effects.nextIncomingAttackNullifyPendingStart = true;
        lines.push(`${actor.name}は次ターン、受ける攻撃ダメージを無効化する！`);
        break;
      case 'trouble_guard':
      case 'stealth':
        actor.effects.nextIncomingAttackNullify = 1;
        actor.effects.nextIncomingAttackNullifyPendingStart = true;
        actor.effects.nextAttackBonus = 8;
        actor.effects.nextAttackBonusTurns = 1;
        actor.effects.nextAttackBonusPendingStart = true;
        lines.push(`${actor.name}は次ターン、${target.name}の攻撃ダメージを無効化し、自分の攻撃ダメージを8上げる！`);
        break;
      case 'martial_arts':
        actor.effects.nextAttackBonus = 10;
        actor.effects.nextAttackBonusTurns = 1;
        actor.effects.nextAttackBonusPendingStart = true;
        lines.push(`${actor.name}は次ターン、攻撃ダメージが10上がる！`);
        break;
      case 'cooking': {
        const before = actor.hp;
        actor.hp = Math.min(100, actor.hp + 20);
        lines.push(`${actor.name}はHPを${actor.hp - before}回復した！`);
        break;
      }
      case 'metabolism':
        actor.effects.regenTurns = 3;
        actor.effects.regenPendingStart = true;
        lines.push(`${actor.name}は次の3ターン、HPを5ずつ回復する！`);
        break;
      case 'heal': {
        const before = actor.hp;
        actor.hp = Math.min(100, actor.hp + 35);
        lines.push(`${actor.name}はHPを${actor.hp - before}回復した！`);
        break;
      }
      case 'wild': {
        const dmg = randomInt(10, 24);
        target.hp = Math.max(0, target.hp - dmg);
        actor.cumulativeDamageDealt += dmg;
        target.cumulativeDamageTaken += dmg;
        lines.push(`${target.name}は${dmg}ダメージを受けた！`);
        break;
      }
      case 'prank':
        target.effects.nextActionRandom = 1;
        target.effects.nextActionRandomPendingStart = true;
        lines.push(`${actor.name}は次ターン、${target.name}の行動をいたずらする！`);
        lines.push(`(※行動を有効選択肢からランダム化)`);
        break;
      case 'kindness': {
        const before = actor.hp;
        actor.hp = Math.min(100, actor.hp + 15);
        actor.effects.damageReduceValue = 5;
        actor.effects.damageReduceTurns = 1;
        actor.effects.damageReducePendingStart = true;
        lines.push(`${actor.name}はHPを${actor.hp - before}回復した！`);
        lines.push(`${actor.name}は次ターン、受けるダメージを5減らす！`);
        break;
      }
      case 'flexibility':
        actor.effects.damageReduceValue = 6;
        actor.effects.damageReduceTurns = 2;
        actor.effects.damageReducePendingStart = true;
        lines.push(`${actor.name}は次の2ターン、受けるダメージを6減らす！`);
        break;
      case 'sharpness':
        actor.effects.nextAttackBonus = 8;
        actor.effects.nextAttackBonusTurns = 1;
        actor.effects.nextAttackBonusPendingStart = true;
        lines.push(`${actor.name}は次ターン、攻撃ダメージが8上がる！`);
        break;
      case 'motivation':
        actor.effects.attackBuffTurns = 2;
        actor.effects.attackBuffPendingStart = true;
        lines.push(`${actor.name}は次の2ターン、攻撃ダメージが6上がる！`);
        break;
      case 'stamina':
        actor.shield += 20;
        lines.push(`${actor.name}はシールドを20得た！`);
        break;
      case 'mystic_power': {
        const roll = randomInt(1, 4);
        const resultLabels = ['相手に20ダメージ', 'HP20回復', 'シールド15', '次ターンの攻撃ダメージ+8'];
        const resultLabel = resultLabels[roll - 1];
        lines.push(`${actor.name}の「不思議な力」は「${resultLabel}」をどんとこいさせた！`);
        if (roll === 1) {
          target.hp = Math.max(0, target.hp - 20);
          actor.cumulativeDamageDealt += 20;
          target.cumulativeDamageTaken += 20;
          lines.push(`${target.name}は20ダメージを受けた！`);
        } else if (roll === 2) {
          const before = actor.hp;
          actor.hp = Math.min(100, actor.hp + 20);
          lines.push(`${actor.name}はHPを${actor.hp - before}回復した！`);
        } else if (roll === 3) {
          actor.shield += 15;
          lines.push(`${actor.name}はシールドを15得た！`);
        } else {
          actor.effects.nextAttackBonus = 8;
          actor.effects.nextAttackBonusTurns = 1;
          actor.effects.nextAttackBonusPendingStart = true;
          lines.push(`${actor.name}は次ターン、攻撃ダメージが8上がる！`);
        }
        break;
      }
      case 'calm_mind':
        actor.effects.damageReduceValue = 10;
        actor.effects.damageReduceTurns = 1;
        actor.effects.damageReducePendingStart = true;
        lines.push(`${actor.name}は次ターン、受けるダメージを10減らす！`);
        break;
      case 'manners': {
        const before = actor.hp;
        actor.hp = Math.min(100, actor.hp + 10);
        actor.effects.negateNextSkill = 1;
        actor.effects.negateNextSkillPendingStart = true;
        lines.push(`${actor.name}はHPを${actor.hp - before}回復した！`);
        lines.push(`${actor.name}は次ターン、${target.name}のスキル発動を無効化する！`);
        break;
      }
      case 'explosion': {
        lines.push(`${actor.name}は「？？？」(スキル)を発動した！`);
        lines.push(`エクスプロージョン！！💥`);
        target.hp = Math.max(0, target.hp - 40);
        actor.cumulativeDamageDealt += 40;
        target.cumulativeDamageTaken += 40;
        lines.push(`${target.name}は40ダメージを受けた！`);
        if (Math.random() < 0.5) {
          actor.hp = Math.max(0, actor.hp - 15);
          actor.cumulativeDamageTaken += 15;
          lines.push(`${actor.name}は反動で15ダメージを受けた！`);
          if (actor.hp <= 0) lines.push(`${actor.name}のHPが0になった！`);
        }
        break;
      }
      default:
        lines.push(`${actor.name}は${skill?.effectShort || skillKey}。`);
    }
  }

  function processAction(actor, target, actorAction, targetAction, currentTurn, lines, state) {
    applyStartOfActionEffects(actor, currentTurn, lines);
    if (actor.hp <= 0) {
      lines.push(`${actor.name}の行動は発動しなかった。`);
      return { hpNote: '変動なし', actionLabel: '行動不能' };
    }
    const processedAction = preprocessAction(actor, target, actorAction, currentTurn, lines);

    if (processedAction.type === 'nullified-skill') {
      return { hpNote: '変動なし', actionLabel: skillDisplay(processedAction.skillKey) };
    }

    if (processedAction.type === 'guard') return { hpNote: '変動なし', actionLabel: '防御' };
    if (processedAction.type === 'evade') return { hpNote: '変動なし', actionLabel: '回避' };

    if (processedAction.type === 'heal') {
      if (processedAction.mode === 'emergency') {
        if (!canUseEmergency(actor)) {
          lines.push(`${actor.name}の行動は発動しなかった。`);
          return { hpNote: '変動なし', actionLabel: '反撃のドラ' };
        }
        actor.emergencyHealUsed = true;
        const before = actor.hp;
        actor.hp = Math.max(actor.hp, 50);
        lines.push(`${actor.name}は反撃のドラを発動！HPが50まで回復した！`);
        return { hpNote: `${actor.hp - before}回復`, actionLabel: '反撃のドラ' };
      }
      if (actor.normalHealUsed >= 1) {
        lines.push(`${actor.name}の行動は発動しなかった。`);
        return { hpNote: '変動なし', actionLabel: '回復' };
      }
      actor.normalHealUsed += 1;
      const before = actor.hp;
      actor.hp = Math.min(100, actor.hp + 20);
      lines.push(`${actor.name}はHPを${actor.hp - before}回復した！`);
      return { hpNote: `${actor.hp - before}回復`, actionLabel: '回復' };
    }

    if (processedAction.type === 'skill') {
      if (!canUseSkill(actor, processedAction.skillKey)) {
        lines.push(`${actor.name}の行動は発動しなかった。`);
        return { hpNote: '変動なし', actionLabel: skillDisplay(processedAction.skillKey) };
      }
      applyScheduledSkill(actor, target, processedAction.skillKey, currentTurn, lines, state);
      return { hpNote: '変動なし', actionLabel: skillDisplay(processedAction.skillKey) };
    }

    if (processedAction.type === 'attack') {
      actor.attackUsage[processedAction.move] = (actor.attackUsage[processedAction.move] || 0) + 1;
      const detailLines = [];
      const result = computeAttackDamage(actor, target, processedAction, targetAction, currentTurn, detailLines);
      detailLines.forEach((line) => lines.push(line));
      if (result.preventedByDragon) {
        return { hpNote: '変動なし', actionLabel: normalActionLabel(processedAction, result.baseDamage), dragonPrevented: true, baseDamage: result.baseDamage };
      }
      if (!result.evaded && !result.nullified) {
        if (result.finalDamage > 0) lines.push(`${target.name}は${result.finalDamage}ダメージを受けた！`);
        else lines.push(`${target.name}はダメージを受けなかった！`);
      }
      return { hpNote: result.finalDamage > 0 ? `${result.finalDamage}ダメージ` : '変動なし', actionLabel: normalActionLabel(processedAction, result.baseDamage), baseDamage: result.baseDamage };
    }

    return { hpNote: '変動なし', actionLabel: selectedActionLabel(processedAction) };
  }

  function finalizeTurnEffects(player) {
    const e = player.effects || {};
    advanceTurnEffect(e, 'nextAttackBonusTurns', 'nextAttackBonusPendingStart', () => { e.nextAttackBonus = 0; });
    advanceTurnEffect(e, 'attackBuffTurns', 'attackBuffPendingStart');
    advanceTurnEffect(e, 'nextIncomingAttackNullify', 'nextIncomingAttackNullifyPendingStart');
    advanceTurnEffect(e, 'damageReduceTurns', 'damageReducePendingStart', () => { e.damageReduceValue = 0; });
    advanceTurnEffect(e, 'halfDamageTurns', 'halfDamagePendingStart');
    advanceTurnEffect(e, 'nextAttackPenaltyTurns', 'nextAttackPenaltyPendingStart', () => { e.nextAttackPenalty = 0; });
    advanceTurnEffect(e, 'nextActionRandom', 'nextActionRandomPendingStart');
    advanceTurnEffect(e, 'negateNextSkill', 'negateNextSkillPendingStart');
    advanceTurnEffect(e, 'regenTurns', 'regenPendingStart');
  }

  function refundDrawBets(state) {
    const info = { p1: state.players.p1.bet || 50, p2: state.players.p2.bet || 50, total: (state.players.p1.bet || 50) + (state.players.p2.bet || 50) };
    ['p1', 'p2'].forEach((role) => {
      const player = state.players[role];
      player.gold += player.bet || 50;
      if (player.debt > 0) {
        const over = Math.max(0, player.gold - player.debt);
        if (over >= 0) {
          const repay = Math.min(player.gold, player.debt);
          player.gold -= repay;
          player.debt -= repay;
        }
      }
    });
    return info;
  }

  function applyWinReward(state, winnerRole) {
    const p1 = state.players.p1, p2 = state.players.p2;
    const winner = state.players[winnerRole];
    let pot = (p1.bet || 50) + (p2.bet || 50);
    let multiplier = 1;
    if (winner.effects.goldLuckActive) {
      multiplier = Math.round((randomInt(12, 18) / 10) * 10) / 10;
      pot = Math.round(pot * multiplier);
    }
    winner.gold += pot;
    if (winner.debt > 0) {
      const repay = Math.min(winner.gold, winner.debt);
      winner.gold -= repay;
      winner.debt -= repay;
    }
    return { pot, multiplier };
  }

  function makeResultSummary(state, rewardInfo) {
    const p1 = state.players.p1, p2 = state.players.p2;
    if (state.winner === 'draw') {
      state.resultSummary = {
        winnerRole: 'draw',
        winnerName: '引き分け',
        turns: state.turn,
        players: {
          p1: { name: p1.name, damageDealt: p1.cumulativeDamageDealt, damageTaken: p1.cumulativeDamageTaken, gold: p1.gold, debt: p1.debt },
          p2: { name: p2.name, damageDealt: p2.cumulativeDamageDealt, damageTaken: p2.cumulativeDamageTaken, gold: p2.gold, debt: p2.debt }
        },
        rewardText: rewardInfo ? `引き分け：BET返還 ${rewardInfo.total}G` : '引き分け'
      };
      return;
    }
    const winnerName = state.players[state.winner].name;
    state.resultSummary = {
      winnerRole: state.winner,
      winnerName,
      turns: state.turn,
      players: {
        p1: { name: p1.name, damageDealt: p1.cumulativeDamageDealt, damageTaken: p1.cumulativeDamageTaken, gold: p1.gold, debt: p1.debt },
        p2: { name: p2.name, damageDealt: p2.cumulativeDamageDealt, damageTaken: p2.cumulativeDamageTaken, gold: p2.gold, debt: p2.debt }
      },
      rewardText: rewardInfo ? `勝利した${winnerName}へ ${rewardInfo.pot}G` : ''
    };
  }

  function startMatch(state) {
    const p1 = state.players.p1, p2 = state.players.p2;
    if (!p1.joined || !p2.joined) throw new Error('両プレイヤーの参加登録が必要です。');
    if (!p1.bodyId || !p2.bodyId) throw new Error('両プレイヤーのボディ選択が必要です。');
    if ((p1.selectedCards || []).length !== 3 || (p2.selectedCards || []).length !== 3) throw new Error('両プレイヤーはカードを3枚選ぶ必要があります。');

    ['p1', 'p2'].forEach((role) => {
      const player = state.players[role];
      const available = Math.max(0, Number(player.gold || 0));
      const bet = Math.min(Math.max(50, Number(player.bet || 50)), Math.max(50, available));
      const shortage = Math.max(0, bet - available);
      player.bet = bet;
      player.debt = shortage;
      player.gold = Math.max(0, available - bet);
      player.hp = 100;
      player.shield = 0;
      player.usedSkills = [];
      player.normalHealUsed = 0;
      player.emergencyHealUsed = false;
      player.submittedAction = null;
      player.actionLocked = false;
      player.message = '';
      player.attackUsage = { kick: 0, throw: 0 };
      player.effects = window.AM.createEffects();
      player.cumulativeDamageDealt = 0;
      player.cumulativeDamageTaken = 0;
      const cards = (player.selectedCards || []).map((id) => window.AM.findCard(id)).filter(Boolean);
      if (cards.length === 3 && cards.every((card) => card.rarity === '★2')) {
        player.shield += 10;
      }
    });

    state.turn = 1;
    state.phase = 'battle';
    state.winner = null;
    state.turnHistories = [];
    state.turnSummary = null;
    state.lastAnimations = { p1: null, p2: null };
    state.turnResolvedAt = 0;
    state.firstAttackRole = Math.random() < 0.5 ? 'p1' : 'p2';
    state.resultSummary = null;
    state.resultRevealVisible = false;
    state.spectatorLogView = 'first';
    state.matchBet = {
      total: (p1.bet || 50) + (p2.bet || 50),
      p1: { name: p1.name, bet: p1.bet || 50 },
      p2: { name: p2.name, bet: p2.bet || 50 }
    };
    state.betRevealVisible = true;
    state.chatHistory = [];
    state.turnExecutionStage = 'first';
    state.pendingTurnData = null;
    state.battleLog = [
      `ーー▼対戦開始ーーーーーーーーーーーーーー`,
      `合計BET額${state.matchBet.total}Gをポットに積みました。`
    ];
  }


  function buildTurnEntries(state, hpBefore, firstRole, firstResult, secondResult, firstLines, secondLines) {
    const p1 = state.players.p1;
    const p2 = state.players.p2;
    return {
      p1: {
        name: p1.name,
        choiceLabel: firstRole === 'p1' ? firstResult.actionLabel : secondResult.actionLabel,
        hpBefore: hpBefore.p1,
        hpAfter: p1.hp,
        shield: p1.shield,
        skillCount: countSkillUses(p1),
        healRemaining: Math.max(0, 1 - p1.normalHealUsed),
        dragonState: dragonState(p1),
        effectsSummary: currentEffectsSummary(p1),
        receivedLines: firstRole === 'p1' ? firstLines.slice(1) : secondLines.slice(1)
      },
      p2: {
        name: p2.name,
        choiceLabel: firstRole === 'p2' ? firstResult.actionLabel : secondResult.actionLabel,
        hpBefore: hpBefore.p2,
        hpAfter: p2.hp,
        shield: p2.shield,
        skillCount: countSkillUses(p2),
        healRemaining: Math.max(0, 1 - p2.normalHealUsed),
        dragonState: dragonState(p2),
        effectsSummary: currentEffectsSummary(p2),
        receivedLines: firstRole === 'p2' ? firstLines.slice(1) : secondLines.slice(1)
      }
    };
  }

  function resolveTurn(state) {
    if (state.phase !== 'battle') return state;
    const p1 = state.players.p1, p2 = state.players.p2;
    if (!p1.actionLocked || !p2.actionLocked) throw new Error('両プレイヤーの行動確定が必要です。');

    const isSecondStep = state.turnExecutionStage === 'second' && state.pendingTurnData;

    if (!isSecondStep) {
      const turn = state.turn;
      const firstRole = state.firstAttackRole || 'p1';
      const secondRole = firstRole === 'p1' ? 'p2' : 'p1';
      const first = state.players[firstRole];
      const second = state.players[secondRole];
      const firstActionOriginal = deepClone(first.submittedAction);
      const secondActionOriginal = deepClone(second.submittedAction);
      const hpBefore = { p1: p1.hp, p2: p2.hp };
      const beforeSnapshot = { p1: { hp: p1.hp, shield: p1.shield || 0 }, p2: { hp: p2.hp, shield: p2.shield || 0 } };
      const firstLines = [`＜先攻：${first.name}のターン＞`, `icon_player_left.png ${first.name}は「${selectedActionLogLabel(firstActionOriginal)}」を選択！`];
      const secondLines = [`＜後攻：${second.name}のターン＞`, `icon_player_right.png ${second.name}は「${selectedActionLogLabel(secondActionOriginal)}」を選択！`];
      const firstResult = processAction(first, second, firstActionOriginal, secondActionOriginal, turn, firstLines, state);
      const secondResult = { hpNote: '変動なし', actionLabel: selectedActionLabel(secondActionOriginal) };
      state.pendingTurnData = { turn, firstRole, secondRole, hpBefore, beforeSnapshot, firstActionOriginal, secondActionOriginal, firstLines, secondLines, firstResult };
      state.turnExecutionStage = 'second';
      state.spectatorLogView = 'first';
      state.turnResolvedAt = Date.now();
      state.turnSummary = {
        turn,
        firstPlayerRole: firstRole,
        firstLines,
        secondLines,
        resultLines: [],
        entries: buildTurnEntries(state, hpBefore, firstRole, firstResult, secondResult, firstLines, secondLines)
      };
      return state;
    }

    const pending = state.pendingTurnData;
    const turn = pending.turn;
    const firstRole = pending.firstRole;
    const secondRole = pending.secondRole;
    const first = state.players[firstRole];
    const second = state.players[secondRole];
    const firstActionOriginal = pending.firstActionOriginal;
    const secondActionOriginal = pending.secondActionOriginal;
    const hpBefore = pending.hpBefore;
    const firstLines = pending.firstLines || [`＜先攻：${first.name}のターン＞`, `icon_player_left.png ${first.name}は「${selectedActionLogLabel(firstActionOriginal)}」を選択！`];
    const secondLines = pending.secondLines || [`＜後攻：${second.name}のターン＞`, `icon_player_right.png ${second.name}は「${selectedActionLogLabel(secondActionOriginal)}」を選択！`];
    const firstResult = pending.firstResult || { hpNote: '変動なし', actionLabel: selectedActionLabel(firstActionOriginal) };

    let secondResult = { hpNote: '変動なし', actionLabel: selectedActionLabel(secondActionOriginal) };
    if (second.hp > 0 || (secondActionOriginal && secondActionOriginal.type === 'heal' && secondActionOriginal.mode === 'emergency' && canUseEmergency(second))) {
      if (firstResult.dragonPrevented) {
        secondLines.push(`${second.name}は反撃のドラを発動！${first.name}の攻撃を無効化し、HPが50まで回復した！`);
        secondResult = { hpNote: `${Math.max(0, second.hp - hpBefore[secondRole])}回復`, actionLabel: '反撃のドラ' };
      } else {
        secondResult = processAction(second, first, secondActionOriginal, firstActionOriginal, turn, secondLines, state);
      }
    } else {
      secondLines.push(`${second.name}の行動は発動しなかった。`);
    }

    finalizeTurnEffects(p1);
    finalizeTurnEffects(p2);

    const p1Diff = p1.hp - hpBefore.p1;
    const p2Diff = p2.hp - hpBefore.p2;
    const p1Note = p1Diff === 0 ? (p1.shield > 0 && hpBefore.p1 === p1.hp ? `🛡️${p1.shield}` : '変動なし') : `${Math.abs(p1Diff)}${p1Diff > 0 ? '回復' : 'ダメージ'}`;
    const p2Note = p2Diff === 0 ? (p2.shield > 0 && hpBefore.p2 === p2.hp ? `🛡️${p2.shield}` : '変動なし') : `${Math.abs(p2Diff)}${p2Diff > 0 ? '回復' : 'ダメージ'}`;
    const resultLines = [
      `＜ターン結果＞`,
      formatSummaryHpLine(p1, hpBefore.p1, p1.hp, p1Note, currentEffectsSummary(p1)),
      formatSummaryHpLine(p2, hpBefore.p2, p2.hp, p2Note, currentEffectsSummary(p2))
    ];

    const headerLines = [`ーー▼${window.AM.formatTurnLogLabel ? window.AM.formatTurnLogLabel(turn) : (circledTurn(turn)+'ターン目')}ーーーーーーーーーーーーーーー`];
    const combinedLines = headerLines.concat(firstLines, secondLines, resultLines);
    state.battleLog = combinedLines.concat(state.battleLog).slice(0, 220);
    state.turnSummary = {
      turn,
      firstPlayerRole: firstRole,
      firstLines,
      secondLines,
      resultLines,
      entries: buildTurnEntries(state, hpBefore, firstRole, firstResult, secondResult, firstLines, secondLines)
    };
    state.turnHistories.unshift(deepClone(state.turnSummary));
    state.turnResolvedAt = Date.now();
    state.pendingTurnData = null;
    state.turnExecutionStage = 'first';
    state.spectatorLogView = 'second';

    p1.submittedAction = null; p2.submittedAction = null; p1.message = ''; p2.message = ''; p1.actionLocked = false; p2.actionLocked = false;

    let rewardInfo = null;
    if (p1.hp <= 0 && p2.hp <= 0) {
      state.phase = 'finished';
      state.winner = 'draw';
      rewardInfo = refundDrawBets(state);
    } else if (p1.hp <= 0) {
      state.phase = 'finished';
      state.winner = 'p2';
      rewardInfo = applyWinReward(state, 'p2');
    } else if (p2.hp <= 0) {
      state.phase = 'finished';
      state.winner = 'p1';
      rewardInfo = applyWinReward(state, 'p1');
    } else if (turn >= 10) {
      state.phase = 'finished';
      if (p1.hp === p2.hp) { state.winner = 'draw'; rewardInfo = refundDrawBets(state); }
      else {
        state.winner = p1.hp > p2.hp ? 'p1' : 'p2';
        rewardInfo = applyWinReward(state, state.winner);
      }
    }

    if (state.phase === 'finished') {
      const endLines = [`ーー▼対戦終了ーーーーーーーーーーーーーー`];
      if (state.winner === 'draw') {
        endLines.push(`⚖️DRAW：引き分け`);
        endLines.push(`各プレイヤーのBET額は返還されました。`);
        endLines.push(`${p1.name}（総与ダメ：${p1.cumulativeDamageDealt}／被ダメ：${p1.cumulativeDamageTaken}）`);
        endLines.push(`${p2.name}（総与ダメ：${p2.cumulativeDamageDealt}／被ダメ：${p2.cumulativeDamageTaken}）`);
      } else {
        const winner = state.players[state.winner];
        const loserRole = state.winner === 'p1' ? 'p2' : 'p1';
        const loser = state.players[loserRole];
        endLines.push(`👑WINNER：${winner.name}（総与ダメ：${winner.cumulativeDamageDealt}／被ダメ：${winner.cumulativeDamageTaken}）`);
        endLines.push(`☠️LOSER：${loser.name}（総与ダメ：${loser.cumulativeDamageDealt}／被ダメ：${loser.cumulativeDamageTaken}）`);
      }
      state.battleLog = endLines.concat(state.battleLog).slice(0, 240);
      makeResultSummary(state, rewardInfo);
    } else {
      state.turn += 1;
      state.firstAttackRole = secondRole;
    }
    return state;
  }

  function rematch(state) {
    if (state.phase !== 'finished') throw new Error('対戦終了後にのみ再戦できます。');
    ['p1', 'p2'].forEach((role) => {
      const player = state.players[role];
      const carryGold = Math.max(0, Number(player.gold || 0));
      player.joined = false;
      player.gold = carryGold;
      player.bet = Math.max(50, Number(player.bet || 50));
      player.debt = 0;
      player.hp = 100;
      player.shield = 0;
      player.bodyId = '';
      player.selectedCards = [];
      player.usedSkills = [];
      player.normalHealUsed = 0;
      player.emergencyHealUsed = false;
      player.submittedAction = null;
      player.actionLocked = false;
      player.message = '';
      player.attackUsage = { kick: 0, throw: 0 };
      player.cumulativeDamageDealt = 0;
      player.cumulativeDamageTaken = 0;
      player.effects = window.AM.createEffects();
    });
    state.phase = 'lobby';
    state.turn = 1;
    state.winner = null;
    state.lastAnimations = { p1: null, p2: null };
    state.turnSummary = null;
    state.turnHistories = [];
    state.turnResolvedAt = 0;
    state.firstAttackRole = null;
    state.resultSummary = null;
    state.rematchToken = (state.rematchToken || 0) + 1;
    state.matchBet = null;
    state.betRevealVisible = false;
    state.resultRevealVisible = false;
    state.spectatorLogView = 'first';
    state.chatHistory = [];
    state.turnExecutionStage = 'first';
    state.pendingTurnData = null;
    state.battleLog = ['再戦準備に入りました。所持Gを確認し、ボディとスキルを選び直してください。'];
    return state;
  }

  window.AM_BATTLE = { startMatch, resolveTurn, rematch, randomActionFor: randomizeAction };
})();
