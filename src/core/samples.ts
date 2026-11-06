import type { RuleId } from "./rules";
export type Sample = {
  id: string;
  title: string;
  problem: string;
  lines: string[];
  words: string;
  expected: RuleId;
  branchAnswer?: string;
  image: string;
};
export const samples: Sample[] = [
  {
    id: "s1",
    title: "移項の符号",
    problem: "3x+4=19",
    lines: ["3x=19+4", "x=23/3"],
    words: "4 を右に移項したから、足しました。",
    expected: "move-sign",
    image: "/samples/s1.svg",
  },
  {
    id: "s2",
    title: "同じ誤答、違う原因",
    problem: "-(x+3)=5",
    lines: ["-x+3=5", "-x=2", "x=-2"],
    words: "かっこを外しました。",
    expected: "minus-tail",
    image: "/samples/s2.svg",
  },
  {
    id: "s3",
    title: "負の係数で割る",
    problem: "-4x=20",
    lines: ["x=5"],
    words: "4 で割りました。",
    expected: "divide-sign",
    image: "/samples/s3.svg",
  },
  {
    id: "s4",
    title: "分母を払う",
    problem: "x/3+2=6",
    lines: ["x+2=18", "x=16"],
    words: "分母の 3 を掛けました。",
    expected: "denominator-constant",
    image: "/samples/s4.svg",
  },
  {
    id: "s5",
    title: "x と数をまとめる",
    problem: "2x+3=20",
    lines: ["5x=20", "x=4"],
    words: "2 と 3 を足して 5x にしました。",
    expected: "unlike-terms",
    image: "/samples/s5.svg",
  },
];
