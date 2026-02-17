export const TEMPLATES = {
  MT: {
    tasks: [
      {
        id: "1",
        input:
          "Robert Kaplan, head of the Federal Reserve Bank of Dallas, says that low bond yields suggest sluggish growth ahead for the economy of the United States.",
        models: [
          {
            output:
              "ሓላፊ ፈደራላዊ ማዕከን ዳላስ ዝዀነ ሮበርት ካፕላን ፡ ትሑት ምትእስሳር ፡ ኣብ ቊጠባ ሕቡራት መንግስትታት ኣመሪካ ሃሳዪ ዕቤት ከም ዝህሉ እዩ ዝሕብር ። ―",
            model: "google-translate",
            rate: 0,
            rank: 0,
          },
          {
            output:
              "ሓላፊ ባንኪ ፌደራል ሪዘርቭ ዳላስ ሮበርት ካፕላን ትሑት ምህርቲ ቦንድ ንቁጠባ ኣሜሪካ ድኹም ዕብየት ከምዝጽበዮ ይሕብር። .",
            model: "lesan",
            rate: 0,
            rank: 0,
          },

          {
            output:
              "ሓላፊ ባንኪ ፌደራል ሪዘርቭ ዳላስ ሮበርት ካፕላን ትሑት ምህርቲ ቦንድ ንቁጠባ ኣሜሪካ ድኹም ዕብየት ከምዝጽበዮ ይሕብር። .",
            model: "nllb",
            rate: 0,
            rank: 0,
          },
        ],
      },
    ],
  },
  ASR: {
    tasks: [
      {
        id: "1",
        input: "path/to/the/audio_01.mp3",
        models: [
          {
            output:
              "ነቲ ኣብ ኣባይ ጎርጅ ዘሎ ምጽናት መገዲ ኰይኑ ዘገልግል ምርምር ፡ ብኢትዮጵያውያን ኣከባቢን ትካል ምርምር ዱርን ፡ ዩኒቨርሲቲ ሰሌ ፡ ዩኒቨርሲቲ ደብረ ማርቆስ ፡ ዩኒቨርሲቲ ዱርን ኮምሽን ክሊማዊ ለውጥን ብሓባር እዩ ተኻይዱ ።",
            model: "google-speech",
            rate: 0,
            rank: 0,
          },
          {
            output:
              "ንኣግራብ ጎልጎል ኣባይ ከም ፍኖተ-ካርታ ኮይኑ ዘገልግል መፅናዕቲ ብኢንስቲትዩት ምርምር ኣከባብን ኣግራብን ኢትዮጵያ፣ ዩኒቨርስቲ ሰላሌ፣ ዩኒቨርስቲ ደብረ ማርቆስን ኮሚሽን ኣግራብን ለውጢ ክሊማን ብሓባር ተሳሊጡ።",
            model: "lesan-asr",
            rate: 0,
            rank: 0,
          },
        ],
      },
    ],
  },
  //   TTS: {
  //     JSON: `{
  //   "tasks": [
  // {
  //       "id": "1",
  //       "input": "ሓላፊ ፈደራላዊ ማዕከን ዳላስ ዝዀነ ሮበርት ካፕላን ፡ ትሑት ምትእስሳር ፡ ኣብ ቊጠባ ሕቡራት መንግስትታት ኣመሪካ ሃሳዪ ዕቤት ከም ዝህሉ እዩ ዝሕብር ።",
  //       "models": [
  //         {
  //           "output": "path/to/the/output/audio_a.mp3",
  //           "model": "A",
  //           "rate": 0,
  //           "rank": 0
  //         },
  //         {
  //           "output": "path/to/the/output/audio_b.mp3",
  //           "model": "B",
  //           "rate": 0,
  //           "rank": 0
  //         }
  //       ]
  //     }
  //   ]
  // }`,
  //     CSV: `id,text,audio_filepath
  // 1,"Hello, how are you?","path/to/generated_audio1.wav"`,
  //     TSV: `id\ttext\taudio_filepath
  // 1\tHello, how are you?\tpath/to/generated_audio1.wav`,
  //     Excel: `id | text                | audio_filepath
  // 1  | Hello, how are you?  | path/to/generated_audio1.wav`,
  //   },
};
