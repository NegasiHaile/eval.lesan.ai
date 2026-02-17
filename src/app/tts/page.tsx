"use client";

import AudioCard from "@/components/inputs/AudioCard";
import SelectOption from "@/components/inputs/SelectOption";
import TranslationInputTextarea from "@/components/inputs/TranslationInputTextarea";
import Container from "@/components/utils/Container";
import { languages } from "@/constants/languages";

const items = [
  {
    source_language: "eng",
    input:
      "We believe every human should be able to consume the webs content in their native language. We want to make sure that everyone has equal access to information to help them understand the world.",
    models: [
      {
        output: "/datasets/sample-tts01-model-A.mp3",
        model: "A",
        rate: 0,
        rank: 0,
      },
      {
        output: "/datasets/sample-tts-01-model-B.mp3",
        model: "B",
        rate: 0,
        rank: 0,
      },
    ],
  },
];

export default function page() {
  return (
    <Container>
      <div className="w-full max-w-6xl space-y-5">
        <div className="w-full">
          <SelectOption
            id="from-language"
            label="Language"
            name="source_language"
            value={items[0].source_language}
            options={languages}
            onChange={() => {}}
            labelClass="absolute md:left-3 border-r-2 md:pr-2.5 opacity-50"
            selectClass="md:pl-24"
            disabled={false}
          />
        </div>

        <div className="w-full block space-y-5 md:flex justify-between space-x-5">
          <TranslationInputTextarea
            name="input"
            isHorizontal={false}
            value={items[0].input}
            maxLength={2500}
            disabled={false}
            onChange={() => {}}
            className=""
            loading={false}
          />

          <div className="w-full space-y-3">
            {items[0].models.map((task, i) => {
              return <AudioCard key={i} type="output" index={i} task={task} />;
            })}
          </div>
        </div>
      </div>
    </Container>
  );
}
