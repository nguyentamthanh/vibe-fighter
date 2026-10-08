import * as Phaser from 'phaser';

import { BLADE_QI_FIGHTERS, BladeQi, BladeQiCaster } from '../game/bladeQi';
import { Fighter, NEUTRAL_FIGHTER_INPUT, type FighterInput } from '../game/fighter';
import { GOLDEN_BELL_FIGHTERS, GoldenBellShield } from '../game/goldenBell';
import { getCharacterDefinition } from '../game/hero';
import { MatchAnnouncer } from '../game/matchAnnouncer';
import { MatchHud } from '../game/matchHud';
import { MatchResults, type RoundOutcome, type RoundRecord } from '../game/matchResults';
import { createStageAmbience } from '../game/stageAmbience';
import { DEFAULT_GROUND_FRACTION, getStageDefinition } from '../game/stageConfig';
import { playSuperCutIn } from '../game/superCutIn';
import { SCENE_KEYS, type AttackProfile, type MatchConfig } from '../game/types';
import { spawnHitSpark, type VfxColor } from '../game/vfx';
import { BaseScene } from './BaseScene';

const EDGE_MARGIN = 170;
const DEPTH_FRONT = 8;
const DEPTH_BACK = 5;
// Blade-qi crescents fly in front of both fighters (and the front ambience), under the HUD.
const QI_DEPTH = 12;

// Fraction of the gap from the screen centre each fighter occupies at spawn.
const SPAWN_OFFSET_FRACTION = 0.18;
// How quickly the camera eases toward the fighters' midpoint (0..1 per frame).
const CAMERA_LERP = 0.14;

const ROUNDS_TO_WIN = 2;
// Seconds on the round clock. When it expires the fighter with more health wins
// (a tie is a draw and replays the round).
const ROUND_SECONDS = 60;
const HUD_DEPTH = 100;
const BANNER_DEPTH = 200;
const OVERLAY_DEPTH = 300;
// The K.O. plays in slow motion for a moment (fighters and their animations).
const KO_SLOW_MOTION = 0.3;
const KO_SLOW_MOTION_MS = 700;

/** The match's high-level state, driving input gating and the HUD. */
type MatchPhase = 'intro' | 'fighting' | 'roundEnd' | 'matchOver';

interface PlayerKeys {
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  crouch: Phaser.Input.Keyboard.Key;
  block: Phaser.Input.Keyboard.Key;
  jump: Phaser.Input.Keyboard.Key;
  light: Phaser.Input.Keyboard.Key;
  heavy: Phaser.Input.Keyboard.Key;
  special: Phaser.Input.Keyboard.Key;
}

/**
 * The versus match: two fighters spawn facing each other and fight a best-of-3
 * (first to {@link ROUNDS_TO_WIN} rounds). Each round runs a "ROUND n / FIGHT!"
 * intro, then live combat — attack boxes vs hurtboxes drive damage, hitstun,
 * knockback, and a knockdown on KO. When the match is decided a game-over
 * overlay offers a rematch or a return to the main menu. P1 is always human;
 * P2 is human in 1v1 or a simple CPU in 1vCPU.
 */
export class MatchScene extends BaseScene {
  private config: MatchConfig = {
    mode: '1v1',
    stageId: 'rooftop-twilight',
    p1CharacterId: '',
    p2CharacterId: ''
  };

  private p1!: Fighter;
  private p2!: Fighter;
  private p1Keys!: PlayerKeys;
  private p2Keys!: PlayerKeys;
  private cpu?: CpuController;
  /** Guard effects keyed by the fighter they protect (only fighters in GOLDEN_BELL_FIGHTERS). */
  private bells = new Map<Fighter, GoldenBellShield>();
  /** Purple aura + crescent launchers for the fighters in BLADE_QI_FIGHTERS. */
  private qiCasters = new Map<Fighter, BladeQiCaster>();
  /** Blade-qi crescents in flight. */
  private bladeQi: BladeQi[] = [];

  private phase: MatchPhase = 'intro';
  private roundNumber = 1;
  private p1Wins = 0;
  private p2Wins = 0;

  private spawnX1 = 0;
  private spawnX2 = 0;

  private stageWorldWidth = 0;
  private maxScroll = 0;
  private groundY = 0;

  private hud!: MatchHud;
  private announcer!: MatchAnnouncer;
  private results?: MatchResults;
  private rounds: RoundRecord[] = [];
  private timeWarp = 1;
  private roundTimeMs = ROUND_SECONDS * 1000;

  constructor() {
    super(SCENE_KEYS.Match);
  }

  init(data: MatchConfig): void {
    if (data) {
      this.config = data;
    }
  }

  create(): void {
    this.cpu = undefined;
    this.phase = 'intro';
    this.roundNumber = 1;
    this.p1Wins = 0;
    this.p2Wins = 0;
    this.rounds = [];
    this.results = undefined;
    this.timeWarp = 1;

    this.markActiveScene(SCENE_KEYS.Match);
    this.cameras.main.setBackgroundColor(0x05070d);

    this.buildStage();
    this.spawnFighters();
    this.registerKeys();
    this.createControlsLegend();

    this.hud = new MatchHud(this, {
      mode: this.config.mode,
      p1CharacterId: this.config.p1CharacterId,
      p2CharacterId: this.config.p2CharacterId,
      roundsToWin: ROUNDS_TO_WIN,
      depth: HUD_DEPTH
    });
    this.hud.slideIn();

    this.announcer = new MatchAnnouncer(this, BANNER_DEPTH, () => this.app.settingsStore.getState());

    if (this.config.mode === '1vcpu') {
      this.cpu = new CpuController();
    }

    this.startRound();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.bells.forEach((bell) => bell.destroy());
      this.bells.clear();
      this.bladeQi.forEach((qi) => qi.destroy());
      this.bladeQi = [];
      this.qiCasters.forEach((caster) => caster.destroy());
      this.qiCasters.clear();
      this.p1?.destroy();
      this.p2?.destroy();
      this.hud?.destroy();
      this.results?.destroy();
      this.announcer?.destroy();
      this.anims.globalTimeScale = 1;
    });
  }

  /**
   * Per-frame loop: feeds both fighters their input (only while fighting),
   * keeps them facing each other, resolves hits, checks for a KO, and redraws
   * the HUD.
   * @param time - Phaser clock time in ms.
   * @param delta - Milliseconds since the previous frame.
   */
  update(time: number, delta: number): void {
    const seconds = (delta * this.timeWarp) / 1000;
    const fighting = this.phase === 'fighting';

    const p1Input = fighting ? this.readKeys(this.p1Keys) : { ...NEUTRAL_FIGHTER_INPUT };
    const p2Input = fighting
      ? this.cpu
        ? this.cpu.update(time)
        : this.readKeys(this.p2Keys)
      : { ...NEUTRAL_FIGHTER_INPUT };

    // Crouching (and crouch-block) is disabled for now: defense is simply
    // block-or-not. The geometric guard-box model still resolves blocks via the
    // standing guard box; the crouch/low path stays in the code but unused.
    p1Input.crouch = false;
    p2Input.crouch = false;

    // CPU occasionally unleashes its special once the meter is charged.
    if (fighting && this.cpu && this.p2.isMeterReady && Phaser.Math.Between(0, 150) === 0) {
      p2Input.special = true;
    }

    this.p1.faceToward(this.p2.x);
    this.p2.faceToward(this.p1.x);

    if (fighting) {
      if (isActing(p1Input)) {
        this.p1.setDepthBase(DEPTH_FRONT);
        this.p2.setDepthBase(DEPTH_BACK);
      } else if (isActing(p2Input)) {
        this.p2.setDepthBase(DEPTH_FRONT);
        this.p1.setDepthBase(DEPTH_BACK);
      }
    }

    this.p1.update(seconds, p1Input);
    this.p2.update(seconds, p2Input);
    this.bells.forEach((bell) => bell.update());
    this.updateBladeQi(seconds);

    this.updateCamera(false);

    if (fighting) {
      this.resolveCombat();
      this.checkForKnockout();

      if (this.phase === 'fighting') {
        this.tickRoundTimer(delta);
        this.hud.applyHealth(this.p1.health01, this.p2.health01);
      }
    }

    this.hud.setMeter(this.p1.meter01, this.p2.meter01);
    this.hud.setTime(Math.ceil(this.roundTimeMs / 1000));
    this.hud.updateWins(this.p1Wins, this.p2Wins);
  }

  /**
   * Checks both directions for a connecting hit and applies damage/block this
   * frame. A swing only lands once thanks to the attacker's connect flag.
   */
  private resolveCombat(): void {
    this.tryHit(this.p1, this.p2);
    this.tryHit(this.p2, this.p1);
  }

  /**
   * Resolves a single attacker -> defender interaction for the current frame.
   * Blocking is purely geometric: the hit is guarded when the attack box
   * overlaps the defender's active guard box (from its block pose).
   * @param attacker - The fighter whose attack box is tested.
   * @param defender - The fighter whose hurtbox is tested.
   */
  private tryHit(attacker: Fighter, defender: Fighter): void {
    if (defender.isDefeated) {
      return;
    }

    const attack = attacker.getActiveAttack();
    if (!attack) {
      return;
    }

    if (this.landStrike(attacker, defender, attack.rect, attack.profile, attack.finisher)) {
      attacker.markAttackConnected();
    }
  }

  /**
   * Applies one strike (a melee attack box or a projectile) to the defender if
   * it overlaps the defender's hurtbox: guard check, damage or chip, meter,
   * hit effects and the Golden Bell. Returns whether it connected.
   * @param attacker - The fighter the strike belongs to.
   * @param defender - The fighter being struck.
   * @param rect - The strike's box in world space.
   * @param baseProfile - Damage, knockback and hitstun of the strike.
   * @param finisherHit - The last hit of a special (launches harder unless blocked).
   */
  private landStrike(
    attacker: Fighter,
    defender: Fighter,
    rect: Phaser.Geom.Rectangle,
    baseProfile: AttackProfile,
    finisherHit: boolean
  ): boolean {
    const hurt = defender.getHurtRect();
    if (!hurt || !Phaser.Geom.Intersects.RectangleToRectangle(rect, hurt)) {
      return false;
    }

    const guard = defender.getGuardRect();
    const blocked = guard !== null && Phaser.Geom.Intersects.RectangleToRectangle(rect, guard);
    const isSpecial = baseProfile.kind === 'special';
    const finisher = finisherHit && !blocked;

    const bell = blocked ? this.bells.get(defender) : undefined;
    // The combo finisher launches harder and stuns longer than a regular hit;
    // the Golden Bell turns a block into a wall that no chip damage gets through.
    const profile = finisher
      ? { ...baseProfile, knockback: baseProfile.knockback * 1.9, hitstun: baseProfile.hitstun * 1.4 }
      : bell
        ? { ...baseProfile, guardBreak: 0 }
        : baseProfile;

    defender.applyHit(profile, attacker.facingDirection, blocked);
    defender.flashHit(blocked);
    attacker.registerOffense(blocked, isSpecial);
    defender.registerDefense(blocked);

    this.spawnHitFx(rect, hurt, blocked, isSpecial, finisher, bell !== undefined);

    if (bell) {
      const contact = Phaser.Geom.Rectangle.GetCenter(rect);
      bell.strike(contact.x, contact.y, attacker.x);
    }

    return true;
  }

  /**
   * Launches and moves the blade-qi crescents, and lands any that reach the
   * opponent (they fly through the air, so a crescent connects once and bursts).
   * @param seconds - Delta time in seconds (already slowed during a K.O.).
   */
  private updateBladeQi(seconds: number): void {
    this.qiCasters.forEach((caster) => this.bladeQi.push(...caster.update(QI_DEPTH)));

    this.bladeQi.forEach((qi) => {
      qi.update(seconds);
      const defender = qi.owner === this.p1 ? this.p2 : this.p1;
      if (qi.isAlive && this.phase === 'fighting' && !defender.isDefeated) {
        if (this.landStrike(qi.owner, defender, qi.rect, qi.owner.specialProfile, qi.finisher)) {
          qi.burst(true);
        }
      }
    });
    this.bladeQi = this.bladeQi.filter((qi) => qi.isAlive);
  }

  /** Removes every crescent in flight and hides the auras (round reset). */
  private clearBladeQi(): void {
    this.bladeQi.forEach((qi) => qi.destroy());
    this.bladeQi = [];
    this.qiCasters.forEach((caster) => caster.hide());
  }

  /**
   * Spawns the impact spark and camera shake for a connecting hit, scaled up for
   * special hits and the combo finisher.
   * @param attackRect - The attacker's attack box (world space).
   * @param hurtRect - The defender's hurtbox (world space).
   * @param blocked - Whether the hit was guarded.
   * @param isSpecial - Whether the attack was a special move.
   * @param finisher - Whether this is the special's finishing hit.
   * @param goldenGuard - The block was made by a Golden Bell fighter (gold spark instead of blue).
   */
  private spawnHitFx(
    attackRect: Phaser.Geom.Rectangle,
    hurtRect: Phaser.Geom.Rectangle,
    blocked: boolean,
    isSpecial: boolean,
    finisher: boolean,
    goldenGuard = false
  ): void {
    const sparkX = (Phaser.Geom.Rectangle.GetCenter(attackRect).x + Phaser.Geom.Rectangle.GetCenter(hurtRect).x) / 2;
    const sparkY = (Phaser.Geom.Rectangle.GetCenter(attackRect).y + Phaser.Geom.Rectangle.GetCenter(hurtRect).y) / 2;

    const color: VfxColor = blocked ? (goldenGuard ? 'gold' : 'blue') : finisher ? 'gold' : 'red';
    const sparkScale = finisher ? 1.7 : isSpecial ? 1.1 : 0.9;
    spawnHitSpark(this, sparkX, sparkY, color, sparkScale);

    if (finisher) {
      this.cameras.main.shake(220, 0.012);
    } else if (isSpecial) {
      this.cameras.main.shake(blocked ? 60 : 90, blocked ? 0.003 : 0.005);
    } else {
      this.cameras.main.shake(blocked ? 60 : 120, blocked ? 0.003 : 0.006);
    }
  }

  /** Ends the round when either fighter is knocked out. */
  private checkForKnockout(): void {
    if (this.p1.isDefeated) {
      this.endRound(2);
    } else if (this.p2.isDefeated) {
      this.endRound(1);
    }
  }

  /**
   * Counts the round clock down while fighting. When it reaches zero the round
   * is decided on remaining health (a tie replays the round as a draw).
   * @param delta - Milliseconds since the previous frame.
   */
  private tickRoundTimer(delta: number): void {
    this.roundTimeMs = Math.max(0, this.roundTimeMs - delta);

    if (this.roundTimeMs <= 0) {
      this.resolveTimeOut();
    }
  }

  /** Decides a timed-out round by comparing remaining health. */
  private resolveTimeOut(): void {
    const p1 = this.p1.health01;
    const p2 = this.p2.health01;

    if (p1 > p2) {
      this.endRound(1, 'time');
    } else if (p2 > p1) {
      this.endRound(2, 'time');
    } else {
      this.drawRound();
    }
  }

  /** Handles a drawn round (timeout with equal health): replays the round. */
  private drawRound(): void {
    if (this.phase !== 'fighting') {
      return;
    }

    this.phase = 'roundEnd';
    this.rounds.push({ winner: 0, outcome: 'draw' });
    this.announcer.showDraw();
    this.time.delayedCall(1600, () => this.startRound());
  }

  /**
   * Places the chosen stage fit to the viewport height, anchored at world x=0,
   * and sets up the scrollable world. The stage's on-screen width becomes the
   * world width; the camera is bounded to it so it can scroll horizontally and
   * stop at the stage ends (producing corners).
   */
  private buildStage(): void {
    const cam = this.cameras.main;
    const stage = getStageDefinition(this.config.stageId);
    const source = this.textures.get(stage.key).getSourceImage();
    const scale = cam.height / (source.height || stage.height);
    this.stageWorldWidth = (source.width || stage.width) * scale;
    this.maxScroll = Math.max(0, this.stageWorldWidth - cam.width);

    this.add.image(0, 0, stage.key).setOrigin(0, 0).setScale(scale).setDepth(0);
    cam.setBounds(0, 0, this.stageWorldWidth, cam.height);
    this.groundY = Math.round(cam.height * (stage.groundFraction ?? DEFAULT_GROUND_FRACTION));
    createStageAmbience(this, stage.ambience ?? [], this.groundY);
  }

  /** Spawns P1 (left, facing right) and P2 (right, facing left). */
  private spawnFighters(): void {
    const cam = this.cameras.main;
    const groundY = this.groundY;
    const minX = EDGE_MARGIN;
    const maxX = this.stageWorldWidth - EDGE_MARGIN;
    const center = this.stageWorldWidth / 2;
    this.spawnX1 = Math.round(center - cam.width * SPAWN_OFFSET_FRACTION);
    this.spawnX2 = Math.round(center + cam.width * SPAWN_OFFSET_FRACTION);

    this.p1 = new Fighter({
      scene: this,
      app: this.app,
      characterId: this.config.p1CharacterId,
      x: this.spawnX1,
      groundY,
      facing: 1,
      minX,
      maxX,
      depth: DEPTH_FRONT,
      onSpecialStart: (fighter) => playSuperCutIn(this, { characterId: fighter.characterId, side: 'left' })
    });

    this.p2 = new Fighter({
      scene: this,
      app: this.app,
      characterId: this.config.p2CharacterId,
      x: this.spawnX2,
      groundY,
      facing: -1,
      minX,
      maxX,
      depth: DEPTH_BACK,
      onSpecialStart: (fighter) => playSuperCutIn(this, { characterId: fighter.characterId, side: 'right' })
    });

    this.bells.clear();
    [this.p1, this.p2]
      .filter((fighter) => GOLDEN_BELL_FIGHTERS.includes(fighter.characterId))
      .forEach((fighter) => {
        this.bells.set(fighter, new GoldenBellShield(this, fighter, () => this.app.settingsStore.getState()));
      });

    this.qiCasters.clear();
    this.bladeQi = [];
    [this.p1, this.p2]
      .filter((fighter) => BLADE_QI_FIGHTERS.includes(fighter.characterId))
      .forEach((fighter) => this.qiCasters.set(fighter, new BladeQiCaster(this, fighter)));
  }

  /**
   * Group-camera tracking: scrolls horizontally to keep both fighters framed
   * around their midpoint, clamped to the stage ends (so it stops at corners),
   * then turns the visible screen edges into movement walls for both fighters.
   * This is what produces the "camera locks until one fighter relents" feel —
   * neither fighter can walk off-screen, so they can only separate as far as the
   * screen is wide.
   * @param snap - When true, jumps to the target scroll instantly (round start)
   *   instead of easing toward it.
   */
  private updateCamera(snap: boolean): void {
    const cam = this.cameras.main;
    const viewWidth = cam.width;
    const midpoint = (this.p1.x + this.p2.x) / 2;
    const targetScroll = Phaser.Math.Clamp(midpoint - viewWidth / 2, 0, this.maxScroll);
    const scrollX = snap ? targetScroll : Phaser.Math.Linear(cam.scrollX, targetScroll, CAMERA_LERP);

    cam.setScroll(scrollX, 0);

    const leftWall = scrollX + EDGE_MARGIN;
    const rightWall = scrollX + viewWidth - EDGE_MARGIN;
    this.p1.setHorizontalBounds(leftWall, rightWall);
    this.p2.setHorizontalBounds(leftWall, rightWall);
  }

  /** Registers the two keyboard control schemes plus the menu shortcut. */
  private registerKeys(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error('MatchScene requires keyboard input');
    }

    const codes = Phaser.Input.Keyboard.KeyCodes;
    this.p1Keys = {
      left: keyboard.addKey(codes.A),
      right: keyboard.addKey(codes.D),
      crouch: keyboard.addKey(codes.S),
      block: keyboard.addKey(codes.C),
      jump: keyboard.addKey(codes.W),
      light: keyboard.addKey(codes.F),
      heavy: keyboard.addKey(codes.G),
      special: keyboard.addKey(codes.V)
    };

    this.p2Keys = {
      left: keyboard.addKey(codes.LEFT),
      right: keyboard.addKey(codes.RIGHT),
      crouch: keyboard.addKey(codes.DOWN),
      block: keyboard.addKey(codes.FORWARD_SLASH),
      jump: keyboard.addKey(codes.UP),
      light: keyboard.addKey(codes.COMMA),
      heavy: keyboard.addKey(codes.PERIOD),
      special: keyboard.addKey(codes.L)
    };

    keyboard.on('keydown-ESC', () => this.goToMenu());
    keyboard.on('keydown-BACKSPACE', () => this.goToMenu());
    keyboard.on('keydown-R', () => {
      if (this.phase === 'matchOver') {
        this.rematch();
      }
    });
  }

  /**
   * Reads a control scheme into a fighter input snapshot. Held keys map to held
   * inputs; jump/light/heavy use edge detection so they fire once per press.
   * @param keys - The player's resolved keys.
   */
  private readKeys(keys: PlayerKeys): FighterInput {
    return {
      left: keys.left.isDown,
      right: keys.right.isDown,
      crouch: keys.crouch.isDown,
      block: keys.block.isDown,
      jump: Phaser.Input.Keyboard.JustDown(keys.jump),
      light: Phaser.Input.Keyboard.JustDown(keys.light),
      heavy: Phaser.Input.Keyboard.JustDown(keys.heavy),
      special: Phaser.Input.Keyboard.JustDown(keys.special)
    };
  }

  /** Draws the control legend at the bottom of the screen. */
  private createControlsLegend(): void {
    const { centerX, height } = this.cameras.main;
    const p1 = 'P1: WASD • F light • G heavy • C block • V special';
    const p2 = this.config.mode === '1vcpu' ? 'P2: CPU' : 'P2: Arrows • , light • . heavy • / block • L special';

    this.add
      .text(centerX, height - 22, `${p1}      ${p2}      Esc Menu`, {
        color: '#cbd5f5',
        fontFamily: 'monospace',
        fontSize: '12px',
        backgroundColor: 'rgba(2, 6, 23, 0.6)',
        padding: { x: 10, y: 5 }
      })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH)
      .setScrollFactor(0);
  }

  /** Resets both fighters to their corners and runs the round intro. */
  private startRound(): void {
    this.phase = 'intro';
    this.roundTimeMs = ROUND_SECONDS * 1000;

    const fullMin = EDGE_MARGIN;
    const fullMax = this.stageWorldWidth - EDGE_MARGIN;
    this.p1.setHorizontalBounds(fullMin, fullMax);
    this.p2.setHorizontalBounds(fullMin, fullMax);

    this.p1.resetForRound(this.spawnX1, 1);
    this.p2.resetForRound(this.spawnX2, -1);
    this.bells.forEach((bell) => bell.hide());
    this.clearBladeQi();
    this.p1.setDepthBase(DEPTH_FRONT);
    this.p2.setDepthBase(DEPTH_BACK);
    this.updateCamera(true);
    this.hud.animateFill();
    this.hud.updateWins(this.p1Wins, this.p2Wins);

    const finalRound = this.p1Wins === ROUNDS_TO_WIN - 1 && this.p2Wins === ROUNDS_TO_WIN - 1;
    this.announcer.showRound(this.roundNumber, finalRound);

    this.time.delayedCall(1000, () => {
      if (this.phase !== 'intro') {
        return;
      }

      this.announcer.showFight();
      this.phase = 'fighting';
      this.p1.setFrozen(false);
      this.p2.setFrozen(false);

      this.time.delayedCall(700, () => this.announcer.hide());
    });
  }

  /**
   * Concludes the current round, tallies the win, and either advances to the
   * next round or ends the match. A K.O. plays in slow motion with the
   * announcer's call (PERFECT when the winner took no damage).
   * @param winner - Which player won (1 or 2).
   * @param how - A knockout or the clock running out.
   */
  private endRound(winner: 1 | 2, how: 'ko' | 'time' = 'ko'): void {
    if (this.phase !== 'fighting') {
      return;
    }

    this.phase = 'roundEnd';
    this.hud.applyHealth(this.p1.health01, this.p2.health01);

    if (winner === 1) {
      this.p1Wins += 1;
    } else {
      this.p2Wins += 1;
    }

    const winnerFighter = winner === 1 ? this.p1 : this.p2;
    const perfect = how === 'ko' && winnerFighter.health01 >= 1;
    const outcome: RoundOutcome = how === 'time' ? 'time' : perfect ? 'perfect' : 'ko';
    this.rounds.push({ winner, outcome });

    const winnerName = getCharacterDefinition(
      winner === 1 ? this.config.p1CharacterId : this.config.p2CharacterId
    ).label.toUpperCase();

    if (how === 'ko') {
      this.announcer.showKnockout(winnerName, perfect);
      this.setSlowMotion(true);
      this.time.delayedCall(KO_SLOW_MOTION_MS, () => this.setSlowMotion(false));
    } else {
      this.announcer.showTimeUp(winnerName);
    }

    this.time.delayedCall(perfect ? 2400 : 2000, () => {
      const matchOver = this.p1Wins >= ROUNDS_TO_WIN || this.p2Wins >= ROUNDS_TO_WIN;

      if (matchOver) {
        this.endMatch(winner);
      } else {
        this.announcer.hide();
        this.roundNumber += 1;
        this.startRound();
      }
    });
  }

  /**
   * Slows the fighters (movement and animations) for the K.O. moment, or restores normal speed.
   * @param on - Whether slow motion is active.
   */
  private setSlowMotion(on: boolean): void {
    this.timeWarp = on ? KO_SLOW_MOTION : 1;
    this.anims.globalTimeScale = on ? KO_SLOW_MOTION : 1;
  }

  /**
   * Shows the results screen with both fighters, the score, the round history
   * and the winner's quote.
   * @param winner - Which player won the match.
   */
  private endMatch(winner: 1 | 2): void {
    this.phase = 'matchOver';
    this.announcer.hide();

    this.results = new MatchResults(this, {
      mode: this.config.mode,
      p1CharacterId: this.config.p1CharacterId,
      p2CharacterId: this.config.p2CharacterId,
      p1Wins: this.p1Wins,
      p2Wins: this.p2Wins,
      roundsToWin: ROUNDS_TO_WIN,
      winner,
      rounds: this.rounds,
      depth: OVERLAY_DEPTH,
      settings: () => this.app.settingsStore.getState(),
      onRematch: () => this.rematch(),
      onMenu: () => this.goToMenu()
    });
  }

  /** Restarts the match from round 1 with the same configuration. */
  private rematch(): void {
    this.results?.destroy();
    this.results = undefined;
    this.rounds = [];
    this.roundNumber = 1;
    this.p1Wins = 0;
    this.p2Wins = 0;
    this.cpu = this.config.mode === '1vcpu' ? new CpuController() : undefined;
    this.startRound();
  }
}

/**
 * Whether an input represents the fighter actively doing something (moving,
 * jumping, or attacking) this frame — used to decide who draws in front.
 * @param input - The fighter input snapshot to test.
 */
function isActing(input: FighterInput): boolean {
  return input.left || input.right || input.jump || input.light || input.heavy;
}

/**
 * A placeholder CPU opponent: mostly idle, occasionally performing a short
 * random action (a strike, a hop, or a brief walk/crouch/block). Produces a
 * {@link FighterInput} each frame for the second fighter in 1vCPU matches.
 */
class CpuController {
  private nextDecisionAt = 0;
  private holdUntil = 0;
  private moveDir = 0;
  private holdCrouch = false;
  private holdBlock = false;

  /**
   * Produce the CPU's input for this frame.
   * @param timeMs - The current Phaser clock time in ms.
   */
  update(timeMs: number): FighterInput {
    const input: FighterInput = { ...NEUTRAL_FIGHTER_INPUT };

    if (timeMs >= this.nextDecisionAt) {
      this.decide(timeMs, input);
      this.nextDecisionAt = timeMs + Phaser.Math.Between(700, 1700);
    }

    if (timeMs < this.holdUntil) {
      if (this.moveDir < 0) {
        input.left = true;
      } else if (this.moveDir > 0) {
        input.right = true;
      }
      input.crouch = input.crouch || this.holdCrouch;
      input.block = input.block || this.holdBlock;
    } else {
      this.moveDir = 0;
      this.holdCrouch = false;
      this.holdBlock = false;
    }

    return input;
  }

  /**
   * Choose the CPU's next behaviour, emitting one-shot strikes immediately and
   * scheduling held movement/guard for a short window.
   * @param timeMs - The current Phaser clock time in ms.
   * @param input - The input snapshot to mutate for one-shot edges.
   */
  private decide(timeMs: number, input: FighterInput): void {
    const roll = Math.random();

    if (roll < 0.32) {
      return;
    }
    if (roll < 0.5) {
      input.light = true;
      return;
    }
    if (roll < 0.63) {
      input.heavy = true;
      return;
    }
    if (roll < 0.72) {
      input.jump = true;
      return;
    }
    if (roll < 0.9) {
      this.moveDir = Math.random() < 0.5 ? -1 : 1;
      this.holdUntil = timeMs + Phaser.Math.Between(350, 800);
      return;
    }

    if (Math.random() < 0.5) {
      this.holdCrouch = true;
    } else {
      this.holdBlock = true;
    }
    this.holdUntil = timeMs + Phaser.Math.Between(350, 800);
  }
}
