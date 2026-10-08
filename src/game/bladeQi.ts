import * as Phaser from 'phaser';

import type { Fighter } from './fighter';

/** Fighters whose special throws purple blade-qi crescents instead of hitting up close. */
export const BLADE_QI_FIGHTERS = ['asura-blade'];

/** Special-animation frames that launch a crescent (one per big slash). */
const LAUNCH_FRAMES = [2, 4];
/** Crescent speed in pixels per second at display scale 1 (scaled by the fighter's display scale). */
const QI_SPEED = 900;
/** A crescent fizzles after travelling this far. */
const QI_RANGE = 1100;
const QI_TEXTURE = 'blade-qi-crescent';
const SPARK_TEXTURE = 'blade-qi-spark';
const AURA_TEXTURE = 'blade-qi-aura';
const QI_TINTS = [0xc084fc, 0xa855f7, 0xe9d5ff];

/** One flying crescent of purple blade-qi. */
export class BladeQi {
  readonly owner: Fighter;
  /** True for the last crescent of the special: it launches like a combo finisher. */
  readonly finisher: boolean;
  private readonly scene: Phaser.Scene;
  private readonly sprite: Phaser.GameObjects.Image;
  private readonly core: Phaser.GameObjects.Image;
  private readonly trail: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly direction: 1 | -1;
  private readonly speed: number;
  private travelled = 0;
  private alive = true;

  constructor(scene: Phaser.Scene, owner: Fighter, finisher: boolean, depth: number) {
    this.scene = scene;
    this.owner = owner;
    this.finisher = finisher;
    this.direction = owner.facingDirection;
    const scale = owner.displayScale * (finisher ? 1.15 : 0.95);
    this.speed = QI_SPEED * owner.displayScale;
    const start = owner.bodyCenter;
    const x = start.x + this.direction * 60 * owner.displayScale;

    this.sprite = scene.add
      .image(x, start.y, QI_TEXTURE)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xa855f7)
      .setScale(scale * 0.4, scale)
      .setFlipX(this.direction === -1)
      .setDepth(depth);
    this.core = scene.add
      .image(x, start.y, QI_TEXTURE)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xf5e9ff)
      .setScale(scale * 0.28, scale * 0.7)
      .setFlipX(this.direction === -1)
      .setDepth(depth + 1);
    scene.tweens.add({ targets: this.sprite, scaleX: scale, duration: 120, ease: 'Quad.Out' });
    scene.tweens.add({ targets: this.core, scaleX: scale * 0.7, duration: 120, ease: 'Quad.Out' });

    this.trail = scene.add
      .particles(0, 0, SPARK_TEXTURE, {
        follow: this.sprite,
        followOffset: { x: -this.direction * 30 * scale, y: 0 },
        lifespan: 360,
        speedX: { min: -this.direction * 160, max: -this.direction * 40 },
        speedY: { min: -60, max: 60 },
        scale: { start: 1.6 * scale, end: 0 },
        alpha: { start: 0.9, end: 0 },
        tint: QI_TINTS,
        blendMode: Phaser.BlendModes.ADD,
        frequency: 14,
        quantity: 2
      })
      .setDepth(depth - 1);
  }

  get isAlive(): boolean {
    return this.alive;
  }

  /** The crescent's hitbox in world space (the bright middle of the arc). */
  get rect(): Phaser.Geom.Rectangle {
    const width = this.sprite.displayWidth * 0.7;
    const height = this.sprite.displayHeight * 0.8;
    return new Phaser.Geom.Rectangle(this.sprite.x - width / 2, this.sprite.y - height / 2, width, height);
  }

  /**
   * Moves the crescent forward; it fizzles out at the end of its range.
   * @param seconds - Delta time in seconds.
   */
  update(seconds: number): void {
    if (!this.alive) {
      return;
    }

    const step = this.speed * seconds;
    this.travelled += step;
    this.sprite.x += this.direction * step;
    this.core.x = this.sprite.x;
    this.core.setAlpha(0.75 + Math.random() * 0.25);

    if (this.travelled > QI_RANGE * this.owner.displayScale) {
      this.burst(false);
    }
  }

  /**
   * Ends the crescent with a burst of sparks (bigger when it struck someone).
   * @param struck - Whether it connected with the opponent.
   */
  burst(struck: boolean): void {
    if (!this.alive) {
      return;
    }

    this.alive = false;
    this.trail.stop();
    const sparks = this.scene.add
      .particles(this.sprite.x, this.sprite.y, SPARK_TEXTURE, {
        lifespan: struck ? 480 : 300,
        speed: { min: 80, max: struck ? 420 : 200 },
        angle: { min: 0, max: 360 },
        scale: { start: (struck ? 2.4 : 1.4) * this.owner.displayScale, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: QI_TINTS,
        blendMode: Phaser.BlendModes.ADD,
        emitting: false
      })
      .setDepth(this.sprite.depth + 2);
    sparks.explode(struck ? 34 : 14);

    this.scene.tweens.add({
      targets: [this.sprite, this.core],
      alpha: 0,
      scaleY: this.sprite.scaleY * (struck ? 1.5 : 0.6),
      duration: struck ? 200 : 260,
      onComplete: () => {
        this.sprite.destroy();
        this.core.destroy();
      }
    });
    this.scene.time.delayedCall(700, () => {
      this.trail.destroy();
      sparks.destroy();
    });
  }

  /** Removes everything at once (round reset / scene shutdown). */
  destroy(): void {
    this.alive = false;
    [this.sprite, this.core, this.trail].forEach((object) => object.destroy());
  }
}

/**
 * Watches one blade-qi fighter: shows a purple aura while the special charges
 * and plays, and launches a {@link BladeQi} on each big slash of the special.
 * The host scene owns the crescents and resolves their hits.
 */
export class BladeQiCaster {
  private readonly scene: Phaser.Scene;
  private readonly fighter: Fighter;
  private readonly aura: Phaser.GameObjects.Image;
  private readonly auraSparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private launched = new Set<number>();
  private lastAction = '';

  constructor(scene: Phaser.Scene, fighter: Fighter) {
    this.scene = scene;
    this.fighter = fighter;
    ensureTextures(scene);

    this.aura = scene.add.image(0, 0, AURA_TEXTURE).setBlendMode(Phaser.BlendModes.ADD).setTint(0x9333ea).setAlpha(0);
    this.auraSparks = scene.add.particles(0, 0, SPARK_TEXTURE, {
      x: { min: -50, max: 50 },
      y: { min: -10, max: 10 },
      lifespan: 700,
      speedY: { min: -170, max: -60 },
      speedX: { min: -30, max: 30 },
      scale: { start: 1.3, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: QI_TINTS,
      blendMode: Phaser.BlendModes.ADD,
      frequency: 30,
      emitting: false
    });
  }

  /**
   * Updates the aura and returns the crescents launched this frame (empty most frames).
   * @param depth - Depth for new crescents (in front of the fighters).
   */
  update(depth: number): BladeQi[] {
    const action = this.fighter.currentAction;
    const powered = action === 'special-charge' || action === 'special';
    const center = this.fighter.bodyCenter;
    const scale = this.fighter.displayScale;

    this.aura.setPosition(center.x, center.y).setScale(scale * 1.25).setDepth(this.fighter.spriteDepth - 1);
    this.aura.setAlpha(powered ? 0.5 + Math.random() * 0.25 : Math.max(0, this.aura.alpha - 0.08));
    this.auraSparks.setPosition(center.x, center.y + 60 * scale).setDepth(this.fighter.spriteDepth + 1);
    this.auraSparks.emitting = powered;

    if (action !== this.lastAction) {
      this.launched.clear();
      this.lastAction = action;
    }

    if (action !== 'special') {
      return [];
    }

    const frame = this.fighter.currentFrame;
    const launches: BladeQi[] = [];
    LAUNCH_FRAMES.forEach((launchFrame, index) => {
      if (frame >= launchFrame && !this.launched.has(launchFrame)) {
        this.launched.add(launchFrame);
        launches.push(new BladeQi(this.scene, this.fighter, index === LAUNCH_FRAMES.length - 1, depth));
        this.scene.cameras.main.shake(90, 0.003);
      }
    });

    return launches;
  }

  /** Hides the aura (round reset). */
  hide(): void {
    this.aura.setAlpha(0);
    this.auraSparks.emitting = false;
    this.launched.clear();
    this.lastAction = '';
  }

  destroy(): void {
    this.aura.destroy();
    this.auraSparks.destroy();
  }
}

/** Draws the crescent, spark and aura textures once per game. */
function ensureTextures(scene: Phaser.Scene): void {
  const textures = scene.textures;

  if (!textures.exists(QI_TEXTURE)) {
    // A crescent bulging toward +x: the outer disc minus a disc shifted back, white so it can be tinted.
    const canvas = textures.createCanvas(QI_TEXTURE, 120, 220);
    const ctx = canvas?.getContext();
    if (canvas && ctx) {
      const glow = ctx.createRadialGradient(40, 110, 10, 40, 110, 110);
      glow.addColorStop(0, 'rgba(255,255,255,1)');
      glow.addColorStop(0.7, 'rgba(255,255,255,0.85)');
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.ellipse(40, 110, 76, 106, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.ellipse(8, 110, 70, 104, 0, 0, Math.PI * 2);
      ctx.fill();
      canvas.refresh();
    }
  }

  if (!textures.exists(SPARK_TEXTURE)) {
    const g = scene.make.graphics({}, false);
    g.fillStyle(0xffffff, 0.4).fillCircle(4, 4, 4);
    g.fillStyle(0xffffff, 1).fillRect(3, 3, 2, 2);
    g.generateTexture(SPARK_TEXTURE, 8, 8);
    g.destroy();
  }

  if (!textures.exists(AURA_TEXTURE)) {
    const canvas = textures.createCanvas(AURA_TEXTURE, 200, 260);
    const ctx = canvas?.getContext();
    if (canvas && ctx) {
      const gradient = ctx.createRadialGradient(100, 130, 10, 100, 130, 125);
      gradient.addColorStop(0, 'rgba(255,255,255,0.9)');
      gradient.addColorStop(0.5, 'rgba(255,255,255,0.35)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(100, 130, 100, 130, 0, 0, Math.PI * 2);
      ctx.fill();
      canvas.refresh();
    }
  }
}
