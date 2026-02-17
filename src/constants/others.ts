import { guidelineTypes } from "@/types/data";
import { DomainTypes, EvalTypeTypes } from "@/types/others";

export const evalTypes: EvalTypeTypes[] = [
  {
    name: "MT",
    value: "mt",
    full_name: "🈸 Machine Translation (MT) Datasets",
    sample_batch: "/datasets/mt-sample-eval-batch.json",
  },
  {
    name: "ASR",
    value: "asr",
    full_name: "🗣️ Automatic Speech Recognition (ASR) Datasets",
    sample_batch: "/datasets/asr-sample-eval-batch.json",
  },
  // {
  //   name: "TTS",
  //   value: "tts",
  //   full_name: "✍️ Text to Speech (TTS) Datasets",
  // sample_batch: "/datasets/tts-sample-eval-batch.json",
  // },
];

export const domainsList: DomainTypes[] = [
  {
    name: "Health",
    description:
      "Covers topics related to physical and mental well-being, healthcare systems, and lifestyle practices that promote health.",
    subdomains: [
      "Medical Care",
      "Wellness",
      "Nutrition",
      "Mental Health",
      "Public Health",
    ],
  },
  {
    name: "Culture",
    description:
      "Explores the creative, intellectual, and social expressions that define communities and societies.",
    subdomains: ["Arts", "History", "Literature", "Philosophy", "Traditions"],
  },
  {
    name: "Agriculture",
    description:
      "Encompasses food production, farming practices, and innovations in cultivating plants and animals.",
    subdomains: [
      "Farming",
      "Livestock",
      "Agri-technology",
      "Sustainability",
      "Food Systems",
    ],
  },
  {
    name: "Sport",
    description:
      "Relates to physical competition, athletic performance, and the broader sports industry.",
    subdomains: [
      "Athletics",
      "Training",
      "Esports",
      "Sports Media",
      "Sports Business",
    ],
  },
  {
    name: "News",
    description:
      "Focuses on current events, reporting, and developments around the world.",
    subdomains: [
      "Global News",
      "Local News",
      "Investigative Journalism",
      "Breaking Events",
      "Sports Coverage",
    ],
  },
  {
    name: "Politics",
    description:
      "Involves governance, public policy, political systems, and civic discourse.",
    subdomains: [
      "Elections",
      "Public Policy",
      "International Affairs",
      "Governance",
      "Political Commentary",
    ],
  },
  {
    name: "Tech",
    description:
      "Centers on technological advancements, digital innovation, and the impact of emerging tools.",
    subdomains: [
      "Artificial Intelligence",
      "Software",
      "Cybersecurity",
      "Hardware",
      "Tech Startups",
    ],
  },
  {
    name: "Legal",
    description:
      "Content related to legal frameworks, consititution, gender equality, rights of individuals, and justice.",
    subdomains: [
      "Women's Rights & Law",
      "Sexual and Gender-Based Violence",
      "Criminal Justice Reform",
      "Discrimination Law",
      "Law & Child Protection",
      "International Human Rights",
      "Cybercrime & Online Harassment",
      "Restorative Justice",
    ],
  },
  {
    name: "Construction",
    description:
      "Covers building design, infrastructure development, and industry practices in construction.",
    subdomains: [
      "Architecture",
      "Engineering",
      "Urban Development",
      "Sustainable Building",
      "Construction Safety",
    ],
  },
  {
    name: "Business",
    description:
      "Focuses on commerce, finance, markets, and economic activity at various scales.",
    subdomains: [
      "Finance",
      "Banking",
      "Investments",
      "Cryptocurrency",
      "Market Trends",
    ],
  },
  {
    name: "Environment",
    description:
      "Addresses ecological systems, sustainability, and the human impact on nature.",
    subdomains: [
      "Climate",
      "Conservation",
      "Renewables",
      "Pollution",
      "Environmental Policy",
    ],
  },
  {
    name: "Education",
    description:
      "Covers learning methods, academic institutions, and the evolving landscape of education.",
    subdomains: [
      "Primary & Secondary Education",
      "Higher Education",
      "Digital Learning",
      "Research",
      "Education Technology",
    ],
  },
  {
    name: "Entertainment",
    description:
      "Focuses on media, performance arts, and industries that produce popular content and experiences.",
    subdomains: ["Film", "Music", "Gaming", "Television", "Pop Culture"],
  },
  {
    name: "Religion",
    description:
      "Explores belief systems, spiritual practices, and religious traditions across cultures.",
    subdomains: [
      "Faith Systems",
      "Spirituality",
      "Theology",
      "Religious Studies",
      "Ethics",
    ],
  },
];

export const tausRating: guidelineTypes[] = [
  {
    scale: 1,
    value: "Critical",
    description:
      "This is for a completely wrong output. The output does not make sense given the source.",
    example: [],
  },
  {
    scale: 2,
    value: "Major",
    description: `There is a serious problem in the output. For example, there is addition of content not in source, some parts of the source are missing or misinterpreted. It would be hard to match output with source without major modifications.`,
    example: [],
  },
  {
    scale: 3,
    value: "Minor",
    description: `The translation has minor problems given the source but requires some minor changes, e.g, changing a word or two to make it fully describe the source.`,
    example: [],
  },
  {
    scale: 4,
    value: "Neutral",
    description: `The output describes the source; however, there may be some problems with style such as punctuation, word order.`,
  },
  {
    scale: 5,
    value: "Kudos",
    description: `Great job! The output correctly describes the source. It’s both accurate and fluent.`,
    example: [],
  },
];
