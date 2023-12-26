import Vector from "../core/Vector";
import { AppContextWithState, appMethods } from "../core/types";
import { checkExhausted } from "../core/utils";
import config from "./config";

interface StripesBauble {
  type: "StripesBauble";
  direction: "Horizontal" | "Vertical";
  stripeColours: string[];
}

interface DotsBauble {
  type: "DotsBauble";
  backgroundColour: string;
  dotColour: string;
  dotPositions: Vector<2>[];
}

interface Light {
  type: "Light";
  colour: string;
  mode: "Blink" | "FadeInOut" | "AlwaysOn";
}

type Bauble = StripesBauble | DotsBauble;

type Decoration = {
  node: Bauble | Light;
  position: Vector<2>;
  createdAt: number;
};

function randomChoice<T>(...arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function createDecorationNode(palette: string[]): Decoration["node"] {
  const type = randomChoice("StripesBauble", "DotsBauble", "Light");
  switch (type) {
    case "StripesBauble":
      return {
        type,
        direction: randomChoice("Horizontal", "Vertical"),
        stripeColours: new Array(Math.floor(3 + Math.random() * 3))
          .fill(undefined)
          .reduce(
            (acc) =>
              acc.length > 0
                ? [
                    ...acc,
                    randomChoice(
                      ...palette.filter((c) => c !== acc[acc.length - 1])
                    ),
                  ]
                : [randomChoice(...palette)],
            []
          ),
      };
    case "DotsBauble": {
      const backgroundColour = randomChoice(...palette);
      const gridSize = 4;
      return {
        type,
        backgroundColour,
        dotColour: randomChoice(
          ...palette.filter((c) => c !== backgroundColour)
        ),
        dotPositions: new Array(gridSize * gridSize)
          .fill(undefined)
          .map((_, i) =>
            Vector.create(
              (2 * ((i % gridSize) + 0.25 + Math.random() / 2)) / gridSize - 1,
              (2 * (Math.floor(i / gridSize) + 0.25 + Math.random() / 2)) /
                gridSize -
                1
            )
          )
          .filter((v) => v.getMagnitude() <= 1),
      };
    }
    case "Light": {
      return {
        type,
        colour: randomChoice(...palette),
        mode: randomChoice("AlwaysOn", "Blink", "FadeInOut"),
      };
    }
  }
}

interface Branch {
  start: Vector<2>;
  end: Vector<2>;
}

interface Present {
  createdAt: number;
  topLeft: Vector<2>;
  bottomRight: Vector<2>;
  backgroundColour: string;
  stripesColour: string;
}

interface State {
  tree: {
    decorations: Decoration[];
    growthPercent: number;
    branches: Branch[];
    newBranches?: Branch[];
    newGrowthPercent: number;
  };
  presents: Present[];
}

function createBranch(start: Vector<2>, end: Vector<2>): Branch {
  return { start, end };
}

function createPresent(
  topLeft: Vector<2>,
  bottomRight: Vector<2>,
  backgroundColour: string,
  stripesColour: string
): Present {
  return {
    createdAt: Date.now(),
    topLeft,
    bottomRight,
    backgroundColour,
    stripesColour,
  };
}

function growTree(
  tree: State["tree"],
  animationStart: number,
  dt: number,
  palette: string[]
): State["tree"] {
  const decorationSpawnInterval = 1000;
  if (tree.newBranches != null) {
    const makeNewDecoration =
      (tree.decorations.length === 0
        ? animationStart
        : tree.decorations[tree.decorations.length - 1].createdAt) +
        decorationSpawnInterval <
        Date.now() && Math.random() < 0.05;
    const decorationBranch = randomChoice(...tree.newBranches);
    const decorations = makeNewDecoration
      ? [
          ...tree.decorations,
          {
            position: decorationBranch.start.lerp(
              decorationBranch.end,
              tree.newGrowthPercent
            ),
            node: createDecorationNode(palette),
            createdAt: Date.now(),
          },
        ]
      : tree.decorations;
    const newGrowthPercent = tree.newGrowthPercent + dt / 2;
    return newGrowthPercent < 1
      ? {
          ...tree,
          decorations,
          newGrowthPercent,
        }
      : {
          ...tree,
          decorations,
          branches: tree.branches.concat(tree.newBranches),
          newBranches: undefined,
          newGrowthPercent: 0,
        };
  } else {
    return {
      ...tree,
      growthPercent: tree.growthPercent + 0.3 * Math.random(),
      newBranches: new Array(1 + Math.floor(Math.random() * 2))
        .fill(undefined)
        .map((): Branch => {
          const baseBranch = randomChoice(...tree.branches);
          const baseBranchDiff = baseBranch.end.copy().sub(baseBranch.start);
          const start = baseBranchDiff
            .copy()
            .multiply(1 - Math.random() ** 2)
            .add(baseBranch.start);
          const newBranchDiff = Vector.randomPointOnUnitCircle(2).multiply(
            0.1 + Math.random() * 0.1
          );
          if (newBranchDiff.dot(baseBranchDiff) < 0) {
            newBranchDiff.multiply(-1);
          }
          return createBranch(start, newBranchDiff.add(start));
        }),
    };
  }
}

function drawBranches(
  dimensions: Vector<2>,
  ctx: CanvasRenderingContext2D,
  branches: Branch[],
  newGrowthPercent: number,
  newBranches?: Branch[]
): void {
  ctx.strokeStyle = "#A1662F";
  branches.forEach(({ start, end }, i) => {
    ctx.lineWidth = Math.max(3, 7 - 2 * Math.log(i + 1));
    ctx.beginPath();
    ctx.moveTo(start.x() * dimensions.x(), start.y() * dimensions.y());
    ctx.lineTo(end.x() * dimensions.x(), end.y() * dimensions.y());
    ctx.stroke();
  });
  newBranches?.forEach(({ start, end }, i) => {
    const currentEnd = start.lerp(end, newGrowthPercent);
    ctx.lineWidth = Math.max(3, 7 - 2 * Math.log(branches.length + i + 1));
    ctx.beginPath();
    ctx.moveTo(start.x() * dimensions.x(), start.y() * dimensions.y());
    ctx.lineTo(
      currentEnd.x() * dimensions.x(),
      currentEnd.y() * dimensions.y()
    );
    ctx.stroke();
  });
}

function drawDecorations(
  dimensions: Vector<2>,
  ctx: CanvasRenderingContext2D,
  decorations: Decoration[]
): void {
  const growTime = 1000;
  const lightInterval = 2000;
  const now = Date.now();
  for (const { node, position, createdAt } of decorations) {
    const decorationSize =
      Math.max(
        10,
        ((dimensions.x() + dimensions.y()) / 120) *
          Math.min(growTime, now - createdAt)
      ) / growTime;
    const drawPos = position
      .copy()
      .multiply(dimensions)
      .add(Vector.DOWN.multiply(decorationSize));

    switch (node.type) {
      case "StripesBauble": {
        const gradient: CanvasGradient =
          node.direction === "Horizontal"
            ? ctx.createLinearGradient(
                drawPos.x() - decorationSize,
                drawPos.y(),
                drawPos.x() + decorationSize,
                drawPos.y()
              )
            : ctx.createLinearGradient(
                drawPos.x(),
                drawPos.y() - decorationSize,
                drawPos.x(),
                drawPos.y() + decorationSize
              );
        node.stripeColours.forEach((colour, i) => {
          if (i > 0) {
            gradient.addColorStop(
              i / node.stripeColours.length,
              "#" + node.stripeColours[i - 1]
            );
          }
          gradient.addColorStop(
            i / node.stripeColours.length,
            "#" + node.stripeColours[i]
          );
        });
        ctx.fillStyle = gradient;

        ctx.beginPath();
        ctx.arc(drawPos.x(), drawPos.y(), decorationSize, 0, 2 * Math.PI);
        ctx.fill();
        break;
      }
      case "DotsBauble": {
        ctx.fillStyle = "#" + node.backgroundColour;
        ctx.beginPath();
        ctx.arc(drawPos.x(), drawPos.y(), decorationSize, 0, 2 * Math.PI);
        ctx.fill();

        const dotSize = decorationSize / 7;

        ctx.fillStyle = "#" + node.dotColour;
        for (const relativeDotPos of node.dotPositions) {
          const dotDrawPos = relativeDotPos
            .copy()
            .multiply(decorationSize - dotSize)
            .add(drawPos);
          ctx.beginPath();
          ctx.arc(dotDrawPos.x(), dotDrawPos.y(), dotSize, 0, 2 * Math.PI);
          ctx.fill();
        }
        break;
      }
      case "Light": {
        ctx.globalCompositeOperation = "lighten";
        const lightSize =
          (node.mode === "FadeInOut"
            ? Math.abs((now % lightInterval) - lightInterval / 2) /
              (lightInterval / 2)
            : node.mode === "Blink"
            ? Math.round(
                Math.abs((now % lightInterval) - lightInterval / 2) /
                  (lightInterval / 2)
              )
            : 1) * decorationSize;
        const gradient = ctx.createRadialGradient(
          drawPos.x(),
          drawPos.y(),
          0,
          drawPos.x(),
          drawPos.y(),
          lightSize
        );
        gradient.addColorStop(0, "#" + node.colour);
        gradient.addColorStop(1, "#" + node.colour + "10");

        ctx.fillStyle = gradient;

        ctx.beginPath();
        ctx.arc(drawPos.x(), drawPos.y(), lightSize, 0, 2 * Math.PI);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
        break;
      }
      default:
        return checkExhausted(node);
    }
  }
}

function drawPresents(
  dimensions: Vector<2>,
  ctx: CanvasRenderingContext2D,
  presents: Present[]
): void {
  const now = Date.now();
  presents.forEach((present) => {
    const progress = dimensions.y() - ((now - present.createdAt) / 20) ** 1.5;
    const yOffset =
      progress > 0 ? Vector.UP.multiply(progress) : Vector.ZERO(2);
    ctx.fillStyle = "#" + present.backgroundColour;
    const drawPos = present.topLeft.copy().multiply(dimensions).add(yOffset);
    const drawDim = present.bottomRight
      .copy()
      .multiply(dimensions)
      .add(yOffset)
      .sub(drawPos);
    ctx.fillRect(drawPos.x(), drawPos.y(), drawDim.x(), drawDim.y());
    ctx.fillStyle = "#" + present.stripesColour;
    ctx.fillRect(
      drawPos.x() + drawDim.x() * 0.4,
      drawPos.y(),
      drawDim.x() * 0.2,
      drawDim.y()
    );
    ctx.fillRect(
      drawPos.x(),
      drawPos.y() + drawDim.y() * 0.4,
      drawDim.x(),
      drawDim.y() * 0.2
    );

    ctx.beginPath();
    ctx.moveTo(drawPos.x() + drawDim.x() * 0.42, drawPos.y());
    ctx.arc(
      drawPos.x() + drawDim.x() * 0.42,
      drawPos.y() - drawDim.x() * 0.09,
      drawDim.x() * 0.09,
      Math.PI / 2,
      (-Math.PI * 3) / 2
    );
    ctx.lineTo(drawPos.x() + drawDim.x() * 0.38, drawPos.y());
    ctx.arc(
      drawPos.x() + drawDim.x() * 0.38,
      drawPos.y() - drawDim.x() * 0.09,
      drawDim.x() * 0.09,
      (-Math.PI * 3) / 2,
      Math.PI / 2,
      true
    );
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(drawPos.x() + drawDim.x() * 0.58, drawPos.y());
    ctx.arc(
      drawPos.x() + drawDim.x() * 0.58,
      drawPos.y() - drawDim.x() * 0.09,
      drawDim.x() * 0.09,
      Math.PI / 2,
      (-Math.PI * 3) / 2
    );
    ctx.lineTo(drawPos.x() + drawDim.x() * 0.62, drawPos.y());
    ctx.arc(
      drawPos.x() + drawDim.x() * 0.62,
      drawPos.y() - drawDim.x() * 0.09,
      drawDim.x() * 0.09,
      (-Math.PI * 3) / 2,
      Math.PI / 2,
      true
    );
    ctx.fill();
  });
}

const presentSpawnInterval = 6000;

function animationFrame({
  paramConfig,
  ctx,
  canvas,
  state,
  time: { animationStart, delta },
}: AppContextWithState<typeof config, State>): State {
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  let newState = { ...state };

  const palette = paramConfig.getVal("palette").flatMap((a) => a);

  if (state.tree.growthPercent < 1 || state.tree.newBranches != null) {
    newState.tree = growTree(state.tree, animationStart, delta / 1000, palette);

    const spawnPresent =
      (newState.presents.length > 0
        ? newState.presents[newState.presents.length - 1].createdAt
        : animationStart - presentSpawnInterval / 2) +
        presentSpawnInterval <
        Date.now() && Math.random() < 0.05;

    if (spawnPresent) {
      const startX = Math.random() * 0.8;
      const backgroundColour = randomChoice(...palette);
      newState.presents.push(
        createPresent(
          Vector.create(startX, 0.8 + 0.1 * Math.random()),
          Vector.create(startX + 0.1 + Math.random() * 0.1, 1),
          backgroundColour,
          randomChoice(...palette.filter((c) => c !== backgroundColour))
        )
      );
    }
  }

  const dimensions = Vector.create(canvas.width, canvas.height);

  drawPresents(dimensions, ctx, newState.presents);
  drawBranches(
    dimensions,
    ctx,
    newState.tree.branches,
    newState.tree.newGrowthPercent,
    newState.tree.newBranches
  );
  drawDecorations(dimensions, ctx, newState.tree.decorations);
  return newState;
}

export default appMethods.stateful<typeof config, State>({
  init: () => {
    const root = Vector.create(0.5, 1);
    return {
      tree: {
        growthPercent: 0,
        decorations: [],
        branches: [],
        newBranches: [
          createBranch(
            root,
            root.copy().add(Vector.UP.multiply(1 / 4 + (Math.random() * 1) / 4))
          ),
        ],
        newGrowthPercent: 0,
      },
      presents: [],
    };
  },
  animationFrame,
});
