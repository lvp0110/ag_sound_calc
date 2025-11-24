import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import Swal from "sweetalert2";
import "./Calculator.css";

const Calculator = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  // State
  const [typeGklTitle, setTypeGklTitle] = useState("выбрать тип гипсокартона");
  const [typeWoolTitle, setTypeWoolTitle] = useState("выбрать тип минваты");
  const [currentGkla, setCurrentGkla] = useState("default");
  const [currentWool, setCurrentWool] = useState("default");
  const [unvisible, setUnvisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState("true");
  const [tableConstrToCalc, setTableConstrToCalc] = useState(null);
  const [counterConstr, setCounterConstr] = useState(0);
  const [visible, setVisible] = useState(false);
  const [currentCategory, setCurrentCategory] = useState(0);
  const [currentSubCategory, setCurrentSubCategory] = useState(0);
  const [currentItems, setCurrentItems] = useState(0);
  // Состояние для отслеживания открытых подкатегорий в каждой секции
  const [openedSubCategories, setOpenedSubCategories] = useState({
    F: null, // null или id подкатегории
    C: null,
    L: null,
    W: null,
  });
  const [template, setTemplate] = useState(null);
  const [profileStep, setProfileStep] = useState(600);
  const [dFrame, setDFrame] = useState(false);
  const [counters, setCounters] = useState(null);
  const [currentConstr, setCurrentConstr] = useState("");
  const [ConstrToCalcToSent, setConstrToCalcToSent] = useState([]);
  const [ConstrToCalc, setConstrToCalc] = useState([]);
  const [isErrorFloor, setIsErrorFloor] = useState(false);
  const [calculatedMaterials, setCalculatedMaterials] = useState([]);
  
  // Ref для прокрутки к selected-item-container
  const selectedItemContainerRef = useRef(null);

  const [constR, setConstR] = useState({
    id: "",
    idType: "",
    title: "",
    type: "",
    lenX: null,
    lenXp: null,
    lenY: null,
    lenZ: null,
    lenZp: null,
    description: "",
    img: "",
    step: null,
    ag_id: "",
    key_id: null,
    AddCeilShift: 0,
  });

  const [constrSent, setConstrSent] = useState({
    Code: "",
    LenX: 0,
    LenY: 0,
    LenZ: 0,
    dframe: false,
    Area: 0,
    Perimeter: 0,
    step: 0,
    AddCeilShift: 0,
    Openings: [],
  });

  const [opening, setOpening] = useState({
    lenX: null,
    lenZ: null,
    Type: "OST_Doors",
  });

  // Constants
  const constRZero = {
    id: "",
    idType: "",
    title: "",
    type: "",
    lenX: null,
    lenY: null,
    lenZ: null,
    description: "",
    img: "",
    step: null,
    ag_id: "",
    key_id: null,
    AddCeilShift: 0,
  };

  const constSentZero = {
    Code: "",
    LenX: 0,
    LenY: 0,
    LenZ: 0,
    dframe: false,
    Area: 0,
    Perimeter: 0,
    step: 0,
    AddCeilShift: 0,
    Openings: [],
  };

  const openingZero = {
    lenX: null,
    lenZ: null,
    Type: "OST_Doors",
  };

  const Categories = [];

  const SubCategories = [
    {
      id: "F",
      title: "ПОЛ",
      c_id: 1,
      img: "../../../Img_constr/icon_floor_white.svg",
      imgBlack: "img/icon_floor.svg",
    },
    {
      id: "C",
      title: "ПОТОЛОК",
      c_id: 1,
      img: "../../../Img_constr/icon_ceiling_white.svg",
      imgBlack: "img/icon_ceiling.svg",
    },
    {
      id: "L",
      title: "ОБЛИЦОВКА",
      c_id: 1,
      img: "../../../Img_constr/icon_frame_white.svg",
      imgBlack: "img/icon_frame.svg",
    },
    {
      id: "W",
      title: "ПЕРЕГОРОДКА",
      c_id: 1,
      img: "../../../Img_constr/icon_partition_white.svg",
      imgBlack: "img/icon_partittion.svg",
    },
    {
      id: 5,
      title: "ОБЛИЦОВКА",
      c_id: 2,
      img: "../../../Img_constr/icon_frame_white.svg",
    },
    {
      id: 6,
      title: "ПОТОЛОК",
      c_id: 2,
      img: "../../../Img_constr/icon_ceiling_white.svg",
    },
  ];

  const Items = [
    {
      id: 1111,
      title: "Акустическая облицовка SOUNDBOARD",
      description:
        "Облицовка стен декоративно-акустическими панелями SOUNDBOARD",
      c_id: "5",
      template: 201,
      img: "/photo_2024-01-27_23-54-07.jpg",
      ag_id: "AG.LSBfr",
      weight: "кг/м2",
    },
    {
      id: 1112,
      title: "Акустический потолок SOUNDBOARD/РАЗДЕЛ В РАЗРАБОТКЕ",
      description:
        "Потолок с применеием декоративно-акустических панелей SOUNDBOARD",
      c_id: "6",
      template: 202,
      img: "/photo_2024-01-27_23-54-07.jpg",
      ag_id: "SB.CE",
      weight: "кг/м2",
    },
    {
      id: 101,
      title: "Перегородка на каркасе 50 мм",
      description: "Перегородка на одинарном каркасе 50 мм",
      c_id: "W",
      template: 50.1,
      img: "/Img_constr/partition/partition_50.webp",
      ag_id: "AG.W101",
      weight: "68 кг/м2",
    },
    {
      id: 102,
      title: "Перегородка на каркасе 75 мм",
      description: "Перегородка на одинарном каркасе 75 мм",
      c_id: "W",
      template: 75.1,
      img: "/Img_constr/partition/partition_75.webp",
      ag_id: "AG.W102",
      weight: "69 кг/м2",
    },
    {
      id: 103,
      title: "Перегородка на каркасе 100 мм",
      description: "Перегородка на одинарном каркасе 100 мм",
      c_id: "W",
      template: 100.1,
      img: "/Img_constr/partition/partition_100.webp",
      ag_id: "AG.W103",
      weight: "70 кг/м2",
    },
    {
      id: 104,
      title: "Перегородка на каркасе Wave 100 мм",
      description: "Перегородка на одинарном каркасе Виброфлекс-Wave 100 мм",
      c_id: "W",
      template: 101.1,
      img: "/Img_constr/partition/partition_100.webp",
      ag_id: "AG.W104",
      weight: "70 кг/м2",
    },
    {
      id: 105,
      title: "Перегородка на каркасе 2x50 мм",
      description:
        "Перегородка на двойном (независимом) сдвоенном каркасе 2x50 мм на раздельных основаниях звукоизолирующих полов",
      c_id: "W",
      template: 50.2,
      img: "/Img_constr/partition/partition_50_2.webp",
      ag_id: "AG.W105",
      weight: "71 кг/м2",
    },
    {
      id: 106,
      title: "Перегородка на каркасе 2x75 мм",
      description:
        "Перегородка на двойном (независимом) сдвоенном каркасе 2x75 мм на раздельных основаниях звукоизолирующих полов",
      c_id: "W",
      template: 75.2,
      img: "/Img_constr/partition/partition_75_2.webp",
      ag_id: "AG.W106",
      weight: "73 кг/м2",
    },
    {
      id: 107,
      title: "Перегородка на каркасе 2x100 мм",
      description:
        "Перегородка на двойном (независимом) сдвоенном каркасе 2x100 мм на раздельных основаниях звукоизолирующих полов",
      c_id: "W",
      template: 100.2,
      img: "/Img_constr/partition/partition_100_2.webp",
      ag_id: "AG.W107",
      weight: "75 кг/м2",
    },
    {
      id: 108,
      title: "Перегородка системы Саундлайн dB-X AL",
      description:
        "Перегородка системы Саундлайн dB-X AL на одинарном каркасе 50 мм",
      c_id: "W",
      template: 8.1,
      img: "/Img_constr/partition/partition_50.webp",
      ag_id: "AG.W108",
      weight: "56 кг/м2",
    },
    {
      id: 201,
      title: "ЗИПС-Вектор",
      description:
        "Звукоизолирующая система ЗИПС-Вектор, смонтированная на стене",
      c_id: "L",
      template: 6,
      img: "/Img_constr/frame/frame_z_vektor.webp",
      ag_id: "AG.Z201",
      weight: "39 кг/м2",
    },
    {
      id: 202,
      title: "ЗИПС-Модуль",
      description:
        "Звукоизолирующая система ЗИПС-Модуль, смонтированная на стене",
      c_id: "L",
      template: 6,
      img: "/Img_constr/frame/frame_z_module.webp",
      ag_id: "AG.Z202",
      weight: "40,5 кг/м2",
    },
    {
      id: 203,
      title: "ЗИПС-III-Ультра",
      description:
        "Звукоизолирующая система ЗИПС-III-Ультра, смонтированная на стене",
      c_id: "L",
      template: 6,
      img: "/Img_constr/frame/frame_IIIUltra.webp",
      ag_id: "AG.Z203",
      weight: "40 кг/м2",
    },
    {
      id: 204,
      title: "ЗИПС-Z4",
      description: "Звукоизолирующая система ЗИПС-Z4, смонтированная на стене",
      c_id: "L",
      template: 6,
      img: "/Img_constr/frame/frame_Z4.webp",
      ag_id: "AG.Z204",
      weight: "40,5 кг/м2",
    },
    {
      id: 205,
      title: "ЗИПС-Синема",
      description:
        "Звукоизолирующая система ЗИПС-Синема, смонтированная на стене",
      c_id: "L",
      template: 6,
      img: "/Img_constr/frame/frame_z_cinema.webp",
      ag_id: "AG.Z205",
      weight: "41 кг/м2",
    },
    {
      id: 206,
      title: "ЗИПС-Слим",
      description:
        "Звукоизолирующая система ЗИПС-Слим, смонтированная на стене",
      c_id: "L",
      template: 6,
      img: "/Img_constr/frame/frame_z_slim.webp",
      ag_id: "AG.Z206",
      weight: "37,5 кг/м2",
    },
    {
      id: 201,
      title: "ЗИПС-Вектор",
      description:
        "Звукоизолирующая система ЗИПС-Вектор, смонтированная на потолке",
      c_id: "C",
      template: 4,
      img: "/Img_constr/ceiling/ceiling_z_vektor.webp",
      ag_id: "AG.Z201",
      weight: "39 кг/м2",
    },
    {
      id: 202,
      title: "ЗИПС-Модуль",
      description:
        "Звукоизолирующая система ЗИПС-Модуль, смонтированная на потолке",
      c_id: "C",
      template: 4,
      img: "/Img_constr/ceiling/ceiling_z_module.webp",
      ag_id: "AG.Z202",
      weight: "40,5 кг/м2",
    },
    {
      id: 203,
      title: "ЗИПС-III-Ультра",
      description:
        "Звукоизолирующая система ЗИПС-III-Ультра, смонтированная на потолке",
      c_id: "C",
      template: 4,
      img: "/Img_constr/ceiling/ceiling_IIIultra.webp",
      ag_id: "AG.Z203",
      weight: "40 кг/м2",
    },
    {
      id: 204,
      title: "ЗИПС-Z4",
      description:
        "Звукоизолирующая система ЗИПС-Z4, смонтированная на потолке",
      c_id: "C",
      template: 4,
      img: "/Img_constr/ceiling/ceiling_z4.webp",
      ag_id: "AG.Z204",
      weight: "40,5 кг/м2",
    },
    {
      id: 205,
      title: "ЗИПС-Синема",
      description:
        "Звукоизолирующая система ЗИПС-Синема, смонтированная на потолке",
      c_id: "C",
      template: 4,
      img: "/Img_constr/ceiling/ceiling_z_cinema.webp",
      ag_id: "AG.Z205",
      weight: "41 кг/м2",
    },
    {
      id: 401,
      title: "Облицовка на каркасе 50 мм",
      description: "Облицовка на независимом сдвоенном каркасе 50 мм",
      c_id: "L",
      template: 50,
      img: "/Img_constr/frame/frame_50.webp",
      ag_id: "AG.L401",
      weight: "37,5 кг/м2",
    },
    {
      id: 402,
      title: "Облицовка на каркасе 75 мм",
      description: "Облицовка на независимом каркасе 75 мм",
      c_id: "L",
      template: 75,
      img: "/Img_constr/frame/frame_75.webp",
      ag_id: "AG.L402",
      weight: "36,5 кг/м2",
    },
    {
      id: 403,
      title: "Облицовка на каркасе 100 мм",
      description: "Облицовка на независимом каркасе 100 мм",
      c_id: "L",
      template: 100,
      img: "/Img_constr/frame/frame_100.webp",
      ag_id: "AG.L403",
      weight: "37,5 кг/м2",
    },
    {
      id: 404,
      title: "Облицовка c применением Виброфлекс-Коннект ПС",
      description:
        "Облицовка на каркасе ПП 60/27 с применением креплений Виброфлекс-Коннект ПС",
      c_id: "L",
      template: 101,
      img: "/Img_constr/frame/frame_connect_pc.webp",
      ag_id: "AG.L404",
      weight: "35,8 кг/м2",
    },
    {
      id: 405,
      title: "Облицовка с применением Виброфлекс-КС",
      description:
        "Облицовка на каркасе ПП 60/27 с применением креплений Виброфлекс-КС",
      c_id: "L",
      template: 101,
      img: "/Img_constr/frame/frame_connect_kc.webp",
      ag_id: "AG.L405",
      weight: "35,8кг/м2",
    },
    {
      id: 501,
      title: "Потолок на креплениях Виброфлекс-Коннект ПП",
      description:
        "Подвесной потолок, смонтированный на креплениях Виброфлекс-Коннект ПП",
      c_id: "C",
      template: 5,
      img: "/Img_constr/ceiling/ceiling_100.webp",
      ag_id: "AG.C501",
      weight: "37 кг/м2",
    },
    {
      id: 502,
      title: "Потолок на креплениях Виброфлекс-К15",
      description:
        "Подвесной потолок, смонтированный на креплениях Виброфлекс-К15",
      c_id: "C",
      template: 5,
      img: "/Img_constr/ceiling/ceiling_130.webp",
      ag_id: "AG.C502",
      weight: "38,5 кг/м2",
    },
    {
      id: 503,
      title: "Потолок на креплениях Виброфлекс-К15 с удлинителями",
      description:
        "Подвесной потолок, смонтированный на креплениях Виброфлекс-К15 с удлинителями из профиля ПП 60/27",
      c_id: "C",
      template: 5,
      img: "/Img_constr/ceiling/ceiling_200.webp",
      ag_id: "AG.C503",
      weight: "40 кг/м2",
    },
    {
      id: 601,
      title: "Пол Акуфлекс-Супер, паркет, 15мм",
      description: "Паркетная доска 15 мм на материале Акуфлекс-Супер",
      c_id: "F",
      template: 1,
      img: "/Img_constr/floor/acuflexLP.png",
      ag_id: "AG.F601",
      weight: "0,46 кг/м2",
    },
    {
      id: 602,
      title: "Пол Акуфлекс-Супер, ламинат, 8 мм",
      description: "Ламинат 8 мм на материале Акуфлекс-Супер",
      c_id: "F",
      template: 1,
      img: "/Img_constr/floor/acuflexLP.png",
      ag_id: "AG.F602",
      weight: "0,46 кг/м2",
    },
    {
      id: 603,
      title: "Пол Акуфлекс-Супер, стяжка, 65 мм",
      description: "Звукоизолирующий пол на материале Акуфлекс-Супер",
      c_id: "F",
      template: 1,
      img: "/Img_constr/floor/acuflex.png",
      ag_id: "AG.F603",
      weight: "120,5 кг/м2",
    },
    {
      id: 604,
      title: "Пол Шуманет-100Комби",
      description: "Звукоизолирующий пол на материале Шуманет-100Комби",
      c_id: "F",
      template: 1,
      img: "/Img_constr/floor/100G_K.png",
      ag_id: "AG.F604",
      weight: "122,5 кг/м2",
    },
    {
      id: 605,
      title: "Пол Шуманет-100Гидро",
      description: "Звукоизолирующий пол на материале Шуманет-100Гидро",
      c_id: "F",
      template: 1,
      img: "/Img_constr/floor/100G_K.png",
      ag_id: "AG.F605",
      weight: "123,4 кг/м2",
    },
    {
      id: 606,
      title: "Пол Шумопласт",
      description: "Звукоизолирующая выравнивающая смесь Шумопласт",
      c_id: "F",
      template: 9,
      img: "/Img_constr/floor/sPlast.png",
      ag_id: "AG.F606",
      weight: "121,4 кг/м2",
    },
    {
      id: "P",
      title: "Акуфлор S20, один слой",
      description:
        "Звукоизолирующий пол с одним слоем системы плит Акуфлор S20",
      c_id: "F",
      template: 2.1,
      img: "/Img_constr/floor/c2k2_1.png",
      ag_id: "AG.F",
      weight: "-",
    },
    {
      id: 607,
      title: "Пол Шумостоп-С2/К2, один слой",
      description:
        "Звукоизолирующий пол с одним слоем системы плит Шумостоп-С2/К2",
      c_id: "F",
      template: 607.1,
      img: "/Img_constr/floor/c2k2_1.png",
      ag_id: "AG.F607",
      weight: "121,8 кг/м2",
    },
    {
      id: 608,
      title: "Пол Шумостоп-С2/К2, два слоя",
      description:
        "Звукоизолирующий пол с двумя слоями системы плит Шумостоп-С2/К2",
      c_id: "F",
      template: 608.1,
      img: "/Img_constr/floor/c2k2_2.png",
      ag_id: "AG.F608",
      weight: "163,7 кг/м2",
    },
    {
      id: 609,
      title: "Пол Шумостоп-К2, один слой",
      description: "Звукоизолирующий пол с одним слоем материала Шумостоп-К2",
      c_id: "F",
      template: 609.1,
      img: "/Img_constr/floor/k2_1.png",
      ag_id: "AG.F609",
      weight: "122,4 кг/м2",
    },
    {
      id: 610,
      title: "Пол Шумостоп-К2, два слоя",
      description: "Звукоизолирующий пол с двумя слоями материала Шумостоп-К2",
      c_id: "F",
      template: 610.1,
      img: "/Img_constr/floor/k2_2.png",
      ag_id: "AG.F610",
      weight: "164,7 кг/м2",
    },
    {
      id: 611,
      title: "Пол Шуманет-Термо",
      description: "Звукоизолирующий пол с одним слоем материала Шуманет-Термо",
      c_id: "F",
      template: 1,
      img: "/Img_constr/floor/termo.png",
      ag_id: "AG.F611",
      weight: "121 кг/м2",
    },
    {
      id: 612,
      title: "Пол Шумостоп-Техно",
      description: "Звукоизолирующий пол с применением панелей Шумостоп-Техно",
      c_id: "F",
      template: 9.1,
      img: "/Img_constr/floor/tehno.png",
      ag_id: "AG.F612",
      weight: "123 кг/м2",
    },
    {
      id: 613,
      title: "ЗИПС-ПОЛ Вектор",
      description: "Сборная звукоизолирующая система ЗИПС-ПОЛ Вектор",
      c_id: "F",
      template: 111,
      img: "/Img_constr/floor/Z_Vector.png",
      ag_id: "AG.F613",
      weight: "49 кг/м2",
    },
    {
      id: 614,
      title: "ЗИПС-ПОЛ Модуль",
      description: "Сборная звукоизолирующая система ЗИПС-ПОЛ Модуль",
      c_id: "F",
      template: 111,
      img: "/Img_constr/floor/Z_Module.png",
      ag_id: "AG.F614",
      weight: "50 кг/м2",
    },
    {
      id: 615,
      title: "Звукоизолирующий пол на лагах",
      description: "Звукоизолирующий пол на лагах",
      c_id: "F",
      template: 3,
      img: "/Img_constr/floor/floor_lags.png",
      ag_id: "AG.F615",
      weight: "11,5 кг/м2",
    },
  ];

  const SizeLimits = [
    { id: "W", id_constr: 101, step: "600", max_lenZ: 4000 },
    { id: "W", id_constr: 101, step: "400", max_lenZ: 5000 },
    { id: "W", id_constr: 101, step: "300", max_lenZ: 6000 },
    { id: "W", id_constr: 102, step: "600", max_lenZ: 5500 },
    { id: "W", id_constr: 102, step: "400", max_lenZ: 6500 },
    { id: "W", id_constr: 102, step: "300", max_lenZ: 7500 },
    { id: "W", id_constr: 103, step: "600", max_lenZ: 6500 },
    { id: "W", id_constr: 103, step: "400", max_lenZ: 7500 },
    { id: "W", id_constr: 103, step: "300", max_lenZ: 8500 },
    { id: "W", id_constr: 104, step: "600", max_lenZ: 6500 },
    { id: "W", id_constr: 104, step: "400", max_lenZ: 7500 },
    { id: "W", id_constr: 104, step: "300", max_lenZ: 8500 },
    { id: "W", id_constr: 105, step: "600", max_lenZ: 4500 },
    { id: "W", id_constr: 105, step: "400", max_lenZ: 5500 },
    { id: "W", id_constr: 105, step: "300", max_lenZ: 6500 },
    { id: "W", id_constr: 106, step: "600", max_lenZ: 6000 },
    { id: "W", id_constr: 106, step: "400", max_lenZ: 7000 },
    { id: "W", id_constr: 106, step: "300", max_lenZ: 8000 },
    { id: "W", id_constr: 107, step: "600", max_lenZ: 6500 },
    { id: "W", id_constr: 107, step: "400", max_lenZ: 7500 },
    { id: "W", id_constr: 107, step: "300", max_lenZ: 8500 },
    { id: "W", id_constr: 108, step: "600", max_lenZ: 3000 },
    { id: "W", id_constr: 108, step: "400", max_lenZ: 4000 },
    { id: "W", id_constr: 108, step: "300", max_lenZ: 5000 },
    { id: "L", id_constr: 401, step: "600", max_lenZ: 3000 },
    { id: "L", id_constr: 401, step: "400", max_lenZ: 3500 },
    { id: "L", id_constr: 401, step: "300", max_lenZ: 4000 },
    { id: "L", id_constr: 402, step: "600", max_lenZ: 3500 },
    { id: "L", id_constr: 402, step: "400", max_lenZ: 4000 },
    { id: "L", id_constr: 402, step: "300", max_lenZ: 4500 },
    { id: "L", id_constr: 403, step: "600", max_lenZ: 4250 },
    { id: "L", id_constr: 403, step: "400", max_lenZ: 5000 },
    { id: "L", id_constr: 403, step: "300", max_lenZ: 5500 },
    { id: "L", id_constr: 404, step: "600", max_lenZ: 10000 },
    { id: "L", id_constr: 404, step: "400", max_lenZ: 10000 },
    { id: "L", id_constr: 404, step: "300", max_lenZ: 10000 },
    { id: "L", id_constr: 405, step: "600", max_lenZ: 10000 },
    { id: "L", id_constr: 405, step: "400", max_lenZ: 10000 },
    { id: "L", id_constr: 405, step: "300", max_lenZ: 10000 },
    { id: "Z.", id_constr: 201, step: "600", max_lenZ: 6000 },
    { id: "Z.", id_constr: 202, step: "600", max_lenZ: 6000 },
    { id: "Z.", id_constr: 203, step: "600", max_lenZ: 6000 },
    { id: "Z.", id_constr: 204, step: "600", max_lenZ: 6000 },
    { id: "Z.", id_constr: 205, step: "600", max_lenZ: 6000 },
    { id: "Z.", id_constr: 206, step: "600", max_lenZ: 6000 },
  ];

  // Computed values
  const getActiveCategories = useMemo(() => {
    return [];
  }, []);

  // Получить подкатегории для конкретной секции
  const getSubCategoriesForSection = useCallback((sectionId) => {
    if (sectionId === "F") {
      return SubCategories.filter((el) => el.id === "F");
    } else if (sectionId === "C") {
      return SubCategories.filter((el) => el.id === "C");
    } else if (sectionId === "L") {
      return SubCategories.filter((el) => el.id === "L");
    } else if (sectionId === "W") {
      return SubCategories.filter((el) => el.id === "W");
    }
    return [];
  }, []);

  // Получить items для конкретной секции и подкатегории
  const getItemsForSection = useCallback((sectionId, subCategoryId) => {
    if (!subCategoryId) return [];
    return Items.filter((el) => el.c_id == subCategoryId);
  }, []);

  // Обработчик клика на секцию (section-container)
  const handleSectionClick = useCallback((sectionId, subCategories) => {
    setOpenedSubCategories((prev) => {
      const currentOpened = prev[sectionId];
      
      // Если секция уже открыта - закрыть её
      if (currentOpened) {
        return { ...prev, [sectionId]: null };
      }
      
      // Если секция закрыта - открыть первую подкатегорию
      if (subCategories && subCategories.length > 0) {
        const firstSubCategory = subCategories[0];
        setCurrentSubCategory(firstSubCategory.id);
        return { ...prev, [sectionId]: firstSubCategory.id };
      }
      
      return prev;
    });
  }, []);

  // Обработчик выбора элемента
  const handleItemSelect = useCallback((item) => {
    if (currentItems === item.id) {
      // Если кликнули на уже выбранный элемент - сбросить выбор
      setCurrentItems(0);
      setTemplate(null);
      setCurrentConstr("");
    } else {
      // Установить новый выбор
      setCurrentItems(item.id);
      setTemplate(item.template);
      setTableConstrToCalc(1);
      setCurrentConstr(item.ag_id);
    }
  }, [currentItems]);

  // Обновляем template и другие параметры при изменении currentItems
  useEffect(() => {
    if (currentItems != 0) {
      const selectedItem = Items.find((el) => el.id == currentItems);
      if (selectedItem) {
        setTemplate(selectedItem.template);
        setTableConstrToCalc(1);
        setCurrentConstr(selectedItem.ag_id);
      }
    } else {
      setTemplate(null);
      setVisible(false);
      setCurrentConstr("");
    }
  }, [currentItems]);

  // Прокрутка к selected-item-container при выборе элемента
  useEffect(() => {
    if (currentItems != 0) {
      // Небольшая задержка для того, чтобы DOM успел обновиться
      setTimeout(() => {
        const container = document.querySelector('.selected-item-container');
        if (container) {
          container.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      }, 100);
    }
  }, [currentItems]);

  // Methods
  const hasHistory = () => {
    return window.history.length > 2;
  };

  const getContsCodeByMaterials = () => {
    if (currentGkla == "default" && currentWool == "default") {
      return currentConstr;
    } else if (currentGkla == "default") {
      return currentConstr + "_" + currentWool;
    } else if (currentWool == "default") {
      return currentConstr + "_" + currentGkla;
    }
    return currentConstr + "_" + currentGkla + "_" + currentWool;
  };

  const convertUnits = (material) => {
    if (material.Units == "м2") {
      const quantityInM2 = material.Quantity / 1e6;
      return quantityInM2.toFixed(2);
    }
    return material.Quantity;
  };

  const filterVariable = (variable) => {
    if (/^\d/.test(variable)) {
      return variable;
    } else {
      return "---";
    }
  };

  const getStartParam = () => {
    setUnvisible(!unvisible);
  };

  const delFromOpenings = (index) => {
    const newOpenings = [...constrSent.Openings];
    newOpenings.splice(index, 1);
    setConstrSent({ ...constrSent, Openings: newOpenings });
  };

  const getOpeningType = (Type) => {
    if (Type == "OST_Doors") return "дверь";
    return "окно";
  };

  const addOpening = () => {
    setConstrSent({
      ...constrSent,
      Openings: [...constrSent.Openings, { ...opening }],
    });
    setOpening({ ...openingZero });
  };

  const setConstrFromCalcToSent = () => {
    const code = getContsCodeByMaterials();
    const newConstrSent = {
      ...constrSent,
      Code: code,
      LenX: constR.lenX,
      LenY: constR.lenY,
      LenZ: constR.lenZ,
      AddCeilShift: constR.AddCeilShift,
      step: +profileStep,
      dframe: dFrame,
    };

    if (code == "AG.L401" || code == "AG.W101" || code == "AG.W105") {
      newConstrSent.dframe = true;
    }
    if (
      (code == "AG.F615" || code == "AG.F615_vibroflex_LD") &&
      profileStep == 600
    ) {
      newConstrSent.step = 400;
    }

    setConstrSent(newConstrSent);
  };

  const delConstrFromList = (idConstr) => {
    const indexToDel = ConstrToCalc.findIndex((el) => el.key_id == idConstr);
    const newConstrToCalc = [...ConstrToCalc];
    const newConstrToCalcToSent = [...ConstrToCalcToSent];
    newConstrToCalc.splice(indexToDel, 1);
    newConstrToCalcToSent.splice(indexToDel, 1);
    setConstrToCalc(newConstrToCalc);
    setConstrToCalcToSent(newConstrToCalcToSent);
    if (newConstrToCalc.length != 0) {
      calcConstruction(newConstrToCalcToSent);
      return;
    }
    setCalculatedMaterials([]);
  };

  const checkInput = () => {
    let objectX;
    let max_constr_size;
    if (currentSubCategory == "W") {
      objectX = SizeLimits.find(
        (el) => el.id_constr == currentItems && el.step == profileStep
      );
      if (!objectX) return null;
      max_constr_size = objectX.max_lenZ;

      if (isNaN(+constR.lenX) || +constR.lenX < 100)
        return '<span class="p1">Введите правильную ширину</span> <br> Минимальная ШИРИНА конструкции 100 мм';
      else if (+constR.lenX > 50000)
        return '<span class="p1">Введите правильную ширину</span> <br> В конструкциях ШИРИНОЙ свыше 15 метров необходимо устраивать температурные(деформационные) швы';
      else if (isNaN(+constR.lenZ) || +constR.lenZ < 100)
        return '<span class="p1">Введите правильную высоту</span> <br> Минимальная ВЫСОТА конструкции 100 мм';
      else if (+constR.lenZ > max_constr_size)
        return '<span class="p1">Введите правильную высоту</span> <br>Максимальная ВЫСОТА конструкции указана в меню выбора шага профиля';
    } else if (currentSubCategory == "L" && template != 6) {
      objectX = SizeLimits.find(
        (el) => el.id_constr == currentItems && el.step == profileStep
      );
      if (!objectX) return null;
      max_constr_size = objectX.max_lenZ;

      if (isNaN(+constR.lenX) || +constR.lenX < 100)
        return '<span class="p1">Введите правильную ширину</span> <br>Минимальная ШИРИНА конструкции 100 мм';
      else if (+constR.lenX > 50000)
        return '<span class="p1">Введите правильную ширину</span> <br>В конструкциях ШИРИНОЙ свыше 15 метров необходимо устраивать  температурные(деформационные) швы';
      else if (isNaN(+constR.lenZ) || +constR.lenZ < 100)
        return '<span class="p1">Введите правильную высоту</span> <br>Минимальная ВЫСОТА конструкции 100 мм';
      else if (+constR.lenZ > max_constr_size)
        return '<span class="p1">Введите правильную высоту</span> <br>Максимальная ВЫСОТА конструкции указана в меню выбора шага профиля';
    } else if (currentSubCategory == "L" && template == 6) {
      objectX = SizeLimits.find(
        (el) => el.id_constr == currentItems && el.step == profileStep
      );
      if (!objectX) return null;
      max_constr_size = objectX.max_lenZ;

      if (isNaN(+constR.lenX) || +constR.lenX < 200)
        return '<span class="p1">Введите правильную ширину</span> <br>Минимальный размер обрезанной панели ЗИПС,пригодной к монтажу,составляет 200 мм.На обрезанном фрагменте должны присутствовать минимум 2 виброузла и 2 регулиремые опоры для панелей ЗИПС-Z4';
      else if (+constR.lenX > 50000)
        return '<span class="p1">Введите правильную ширину</span> <br>В конструкциях ШИРИНОЙ свыше 15 метров необходимо устраивать температурные(деформационные) швы';
      else if (isNaN(+constR.lenZ) || +constR.lenZ < 200)
        return '<span class="p1">Введите правильную высоту</span> <br>Минимальный размер обрезанной панели ЗИПС,пригодной к монтажу,составляет 200 мм.На обрезанном фрагменте должны присутствовать минимум 2 виброузла и 2 регулиремые опоры для панелей ЗИПС-Z4';
      else if (+constR.lenZ > max_constr_size)
        return '<span class="p1">Введите правильную высоту</span> <br>При монтаже панельной системы ЗИПС на ВЫСОТУ более 6 м рекомендуется устраивать деформационный шов  ';
    } else if (currentSubCategory == "C" && template == 5) {
      if (isNaN(+constR.lenX) || +constR.lenX < 250)
        return '<span class="p1">Введите правильную ширину</span> <br>Минимальная ШИРИНА конструкции 250 мм';
      else if (+constR.lenX > 50000)
        return '<span class="p1">Введите правильную ширину</span> <br>В конструкциях ШИРИНОЙ свыше 15 метров необходимо устраивать температурные(деформационные) швы';
      else if (isNaN(+constR.lenY) || +constR.lenY < 250)
        return '<span class="p1">Введите правильную длину</span> <br>Минимальная ДЛИНА конструкции 250 мм';
      else if (+constR.lenY > 50000)
        return '<span class="p1"><span class="p1">Введите правильную длину</span></span> <br>В конструкциях ДЛИНОЙ свыше 15 метров необходимо устраивать температурные(деформационные) швы';
    } else if (currentSubCategory == "5" && template == 201) {
      if (isNaN(+constR.lenX) || +constR.lenX < 250)
        return '<span class="p1">Введите правильную ширину</span> <br>Минимальная ШИРИНА конструкции 250 мм';
      else if (+constR.lenX > 50000)
        return '<span class="p1">Введите правильную ширину</span> <br>В конструкциях ШИРИНОЙ свыше 15 метров необходимо устраивать температурные(деформационные) швы';
      else if (isNaN(+constR.lenZ) || +constR.lenZ < 250)
        return '<span class="p1">Введите правильную высоту</span> <br>Минимальная ВЫСОТА конструкции 250 мм';
      else if (+constR.lenZ > 50000)
        return '<span class="p1"><span class="p1">Введите правильную высоту</span></span> <br>В конструкциях ВЫСОТОЙ свыше 15 метров необходимо устраивать температурные(деформационные) швы';
    } else if (currentSubCategory == "6" && template == 202) {
      if (isNaN(+constR.lenX) || +constR.lenX < 250)
        return '<span class="p1">Введите правильную ширину</span> <br>Минимальная ШИРИНА конструкции 250 мм';
      else if (+constR.lenX > 50000)
        return '<span class="p1">Введите правильную ширину</span> <br>В конструкциях ШИРИНОЙ свыше 15 метров необходимо устраивать температурные(деформационные) швы';
      else if (isNaN(+constR.lenY) || +constR.lenY < 250)
        return '<span class="p1">Введите правильную длину</span> <br>Минимальная ДЛИНА конструкции 250 мм';
      else if (+constR.lenY > 50000)
        return '<span class="p1"><span class="p1">Введите правильную длину</span></span> <br>В конструкциях ДЛИНОЙ свыше 15 метров необходимо устраивать температурные(деформационные) швы';
    } else if (currentSubCategory == "C" && template == 4) {
      if (isNaN(+constR.lenX) || +constR.lenX < 200)
        return '<span class="p1">Введите правильную ширину</span> <br>Минимальный размер обрезанной панели ЗИПС,пригодной к монтажу,составляет 200 мм.На обрезанном фрагменте должны присутствовать минимум 2 виброузла и 2 регулиремые опоры для панелей ЗИПС-Z4';
      else if (+constR.lenX > 50000)
        return '<span class="p1">Введите правильную ширину</span> <br>Акустические швы в обязательном порядке устраиваются в дверных проемах,а также в местах сооружения звукоизоляционных перегородок ';
      else if (isNaN(+constR.lenY) || +constR.lenY < 200)
        return '<span class="p1">Введите правильную длину</span> <br>Минимальный размер обрезанной панели ЗИПС,пригодной к монтажу,составляет 200 мм.На обрезанном фрагменте должны присутствовать минимум 2 виброузла и 2 регулиремые опоры для панелей ЗИПС-Z4';
      else if (+constR.lenY > 50000)
        return '<span class="p1">Введите правильную длину</span> <br>Акустические швы в обязательном порядке устраиваются в дверных проемах,а также в местах сооружения звукоизоляционных перегородок';
    }
    return null;
  };

  const checkInputFloor = () => {
    if (currentSubCategory == "F" && template != 111 && template != 3) {
      if (isNaN(+constR.lenX) || +constR.lenX < 500)
        return '<span class="p1">Введите правильную ширину</span> <br>Минимальная ШИРИНА конструкции 500 мм';
      else if (isNaN(+constR.lenY) || +constR.lenY < 500)
        return '<span class="p1">Введите правильную длину</span> <br>Минимальная ДЛИНА конструкции 500 мм';
    } else if (currentSubCategory == "F" && template == 111) {
      if (isNaN(+constR.lenX) || +constR.lenX < 200)
        return '<span class="p1">Введите правильную ширину</span> <br>Обрезанные панели ЗИПС ШИРИНОЙ менее 200 мм не используются';
      else if (isNaN(+constR.lenY) || +constR.lenY < 200)
        return '<span class="p1">Введите правильную длину</span> <br>Обрезанные панели ЗИПС ДЛИНОЙ менее 200 мм не используются';
      else if (+constR.lenY > 18000)
        return '<span class="p1">Введите правильную длину</span> <br>Акустические швы в обязательном порядке устраиваются в дверных проемах,а также в местах сооружения звукоизоляционных перегородок';
    } else if (currentSubCategory == "F" && template == 3) {
      if (isNaN(+constR.lenX) || +constR.lenX < 500)
        return '<span class="p1">Введите правильную ширину</span> <br>Минимальная ШИРИНА конструкции 500 мм';
      else if (isNaN(+constR.lenY) || +constR.lenY < 500)
        return '<span class="p1">Введите правильную длину</span> <br>Минимальная ДЛИНА конструкции 500 мм';
    }
    return null;
  };

  const checkInputMaxFloor = () => {
    if (currentSubCategory == "F" && template != 111 && template != 3) {
      if (+constR.lenX > 18000)
        return '<span class="p1">Внимание!</span> <br>Расстояние между деформационными швами не должно превышать 18 метров. Деформационные и термоусадочные швы устраиваются по необходимости в соответсвии с требованиями СП 29.13330.2011. <br> Акустические швы в обязательном порядке устраиваются в дверных проемах,а также в местах сооружения звукоизоляционных перегородок.';
      else if (+constR.lenY > 18000)
        return '<span class="p1">Внимание!</span> <br>Расстояние между деформационными швами не должно превышать 18 метров. Деформационные и термоусадочные швы устраиваются по необходимости в соответсвии с требованиями СП 29.13330.2011. <br>  Акустические швы в обязательном порядке устраиваются в дверных проемах, а также в местах сооружения звукоизоляционных перегородок.';
    } else if (currentSubCategory == "F" && template == 111) {
      if (+constR.lenX > 18000)
        return '<span class="p1">Внимание!</span> <br>Расстояние между деформационными швами не должно превышать 18 метров. Деформационные и термоусадочные швы устраиваются по необходимости в соответсвии с требованиями СП 29.13330.2011. <br> Акустические швы в обязательном порядке устраиваются в дверных проемах,а также в местах сооружения звукоизоляционных перегородок.';
      else if (+constR.lenY > 18000)
        return '<span class="p1">Внимание!</span> <br>Расстояние между деформационными швами не должно превышать 18 метров. Деформационные и термоусадочные швы устраиваются по необходимости в соответсвии с требованиями СП 29.13330.2011. <br>  Акустические швы в обязательном порядке устраиваются в дверных проемах, а также в местах сооружения звукоизоляционных перегородок.';
    } else if (currentSubCategory == "F" && template == 3) {
      if (+constR.lenX > 18000)
        return '<span class="p1">Внимание!</span> <br>Расстояние между деформационными швами не должно превышать 18 метров. Деформационные и термоусадочные швы устраиваются по необходимости в соответсвии с требованиями СП 29.13330.2011. <br> Акустические швы в обязательном порядке устраиваются в дверных проемах,а также в местах сооружения звукоизоляционных перегородок.';
      else if (+constR.lenY > 18000)
        return '<span class="p1">Внимание!</span> <br>Расстояние между деформационными швами не должно превышать 18 метров. Деформационные и термоусадочные швы устраиваются по необходимости в соответсвии с требованиями СП 29.13330.2011. <br>  Акустические швы в обязательном порядке устраиваются в дверных проемах, а также в местах сооружения звукоизоляционных перегородок.';
    }
    return null;
  };

  const calcConstruction = async (constrList) => {
    try {
      // Проверяем, что список не пустой
      if (!constrList || constrList.length === 0) {
        console.warn("Empty construction list");
        setCalculatedMaterials({ data: [] });
        return;
      }

      console.log(
        "Calculating construction with:",
        JSON.stringify(constrList, null, 2)
      );

      // Используем прокси в dev режиме, прямой URL в production
      const apiUrl = import.meta.env.DEV
        ? "/api/v1/calcIsolation/byProduct"
        : "https://db.acoustic.ru:3005/api/v1/calcIsolation/byProduct";

      console.log("Fetching from URL:", apiUrl);

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(constrList),
        mode: "cors", // Явно указываем режим CORS
      });

      console.log("Response status:", response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API error response:", errorText);
        throw new Error(
          `HTTP error! status: ${response.status}, message: ${errorText}`
        );
      }

      const data = await response.json();
      console.log("API response received:", data);
      console.log("Response data structure:", {
        hasData: !!data.data,
        dataLength: data.data?.length,
        dataType: typeof data,
        keys: Object.keys(data),
      });

      // Обрабатываем разные форматы ответа
      if (data && data.data) {
        setCalculatedMaterials(data);
      } else if (Array.isArray(data)) {
        // Если API возвращает массив напрямую
        setCalculatedMaterials({ data: data });
      } else {
        console.warn("Unexpected response format:", data);
        setCalculatedMaterials({ data: [] });
      }
    } catch (error) {
      console.error("Error calculating construction:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });

      Swal.fire({
        title: "Ошибка",
        html: `Не удалось рассчитать материалы.<br><br>Ошибка: ${error.message}<br><br>Проверьте консоль для деталей.`,
        icon: "error",
        confirmButtonColor: "#6cabc8",
      });

      // Устанавливаем пустые данные, чтобы не показывать старые
      setCalculatedMaterials({ data: [] });
    }
  };

  const addConstrToCalc = () => {
    const floorError = checkInputFloor();

    if (floorError) {
      Swal.fire({
        html: floorError,
        imageWidth: 60,
        imageHeight: 50,
        imageUrl: "../../../logo1.png",
        confirmButtonText: "Ok",
        confirmButtonColor: "#6cabc8",
      });
    } else {
      const floorMaxError = checkInputMaxFloor();
      if (floorMaxError) {
        Swal.fire({
          html: floorMaxError,
          imageWidth: 60,
          imageHeight: 50,
          imageUrl: "../../../logo1.png",
          confirmButtonText: "Принять",
          confirmButtonColor: "#6cabc8",
        });
      }
      if (checkInput() == null) {
        const IconType = SubCategories.find(
          (el) => el.id == currentSubCategory
        );
        const Description = Items.find((el) => el.id == currentItems);
        const Constr = Items.find((el) => el.id == currentItems);
        const ConstrType = SubCategories.find(
          (el) => el.id == currentSubCategory
        );
        const ConstrId = Items.find((el) => el.id == currentItems);
        const StepProfile = Items.find((el) => el.id == currentItems);

        const newConstR = {
          ...constR,
          imgBlack: IconType?.imgBlack,
          description: Description?.description,
          key_id: Date.now(),
          title: Constr?.title,
          type: ConstrType?.title,
          ag_id: ConstrId?.ag_id,
          step: StepProfile?.step,
          weight: StepProfile?.weight,
        };

        // Update constrSent before adding to list
        const code = getContsCodeByMaterials();

        // Calculate Area and Perimeter based on construction type
        // API expects Area and Perimeter as integers (in mm² and mm respectively)
        let area = 0;
        let perimeter = 0;

        if (currentSubCategory == "F") {
          // Floor: Area = lenX * lenY (in mm²)
          area = Math.round(+constR.lenX * +constR.lenY);
          perimeter = Math.round(2 * (+constR.lenX + +constR.lenY)); // in mm
        } else if (currentSubCategory == "C") {
          // Ceiling: Area = lenX * lenY (in mm²)
          area = Math.round(+constR.lenX * +constR.lenY);
          perimeter = Math.round(2 * (+constR.lenX + +constR.lenY)); // in mm
        } else if (currentSubCategory == "W" || currentSubCategory == "L") {
          // Wall/Frame: Area = lenX * lenZ (in mm²)
          area = Math.round(+constR.lenX * +constR.lenZ);
          perimeter = Math.round(2 * (+constR.lenX + +constR.lenZ)); // in mm
        }

        const newConstrSent = {
          Code: code,
          LenX: +constR.lenX || 0,
          LenY: +constR.lenY || 0,
          LenZ: +constR.lenZ || 0,
          AddCeilShift: +constR.AddCeilShift || 0,
          step: +profileStep,
          dframe: dFrame,
          Area: area,
          Perimeter: perimeter,
          Openings: [...constrSent.Openings],
        };

        if (code == "AG.L401" || code == "AG.W101" || code == "AG.W105") {
          newConstrSent.dframe = true;
        }
        if (
          (code == "AG.F615" || code == "AG.F615_vibroflex_LD") &&
          profileStep == 600
        ) {
          newConstrSent.step = 400;
        }

        const deep = JSON.parse(JSON.stringify(newConstrSent));
        const updatedList = [...ConstrToCalcToSent, deep];
        console.log("Sending to API:", updatedList);

        setConstrToCalcToSent(updatedList);
        setConstrSent({ ...constSentZero });
        setOpening({ ...openingZero });
        setConstrToCalc([...ConstrToCalc, newConstR]);
        calcConstruction(updatedList);
        setConstR({ ...constRZero });
        setDFrame(false);
        setUnvisible(false);
        setProfileStep(600);
        setCurrentGkla("default");
        setCurrentWool("default");
      } else {
        Swal.fire({
          html: checkInput(),
          imageWidth: 60,
          imageHeight: 50,
          imageUrl: "../../../logo1.png",
          confirmButtonText: "OK",
          confirmButtonColor: "#6cabc8",
        });
      }
    }
  };

  const tableToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("My Sheet");

    const addTableDataToSheet = (tableId) => {
      const table = document.getElementById(tableId);
      if (!table) return;
      const rows = table.querySelectorAll("tr");

      rows[0].querySelectorAll("th").forEach((th, index) => {
        const cell = worksheet.getCell(1, index + 1);
        cell.value = th.innerText;
        cell.font = { bold: true, color: { argb: "FF000000" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFDCDCDC" },
        };
      });

      for (let i = 1; i < rows.length; i++) {
        const data = [];
        const cells = rows[i].querySelectorAll("th,td");
        cells.forEach((td) => data.push(td.innerText));
        worksheet.addRow(data);
      }

      worksheet.addRow([]);
    };

    addTableDataToSheet("table1");
    addTableDataToSheet("table2");

    worksheet.eachRow({ includeEmpty: true }, function (row) {
      row.eachCell({ includeEmpty: true }, function (cell) {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
    });

    worksheet.columns.forEach(function (column) {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, function (cell) {
        const columnLength = cell.value ? cell.value.toString().length : 0;
        maxLength = Math.max(maxLength, columnLength + 2);
      });
      column.width = maxLength < 10 ? 10 : maxLength;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, "Tables.xlsx");
  };

  const copyTableToClipboard = () => {
    const table = document.getElementById("table2");
    if (!table) return;
    const rows = table.querySelectorAll("tr");
    let textToCopy = "";

    for (let i = 2; i < rows.length; i++) {
      const cells = rows[i].querySelectorAll("td");
      if (cells.length > 0 && cells[0].innerText.trim() === "---") {
        continue;
      }
      const rowText = [];
      for (let j = 0; j < cells.length - 1; j++) {
        rowText.push(cells[j].innerText);
      }
      textToCopy += rowText.join("\t") + "\n";
    }

    navigator.clipboard
      .writeText(textToCopy)
      .then(() => {
        alert(
          "Данные скопированы в буфер обмена. Для получения расчета конструкций необходимо вставить данные в ERP/Заказ клиента/Товары/Заполнить/Загрузить из внешнего файла/Артикул "
        );
      })
      .catch((err) => {
        console.error("Ошибка при копировании: ", err);
      });
  };

  // Initialize from route params
  useEffect(() => {
    if (id != null) {
      const item = Items.find((item) => item.ag_id === id);
      if (item) {
        const subCategory = SubCategories.find(
          (subCategory) => subCategory.id === item.c_id
        );
        if (subCategory) {
          setCurrentItems(item.id);
          setCurrentSubCategory(subCategory.id);
          
          // Определяем секцию по c_id и открываем соответствующую подкатегорию
          const sectionId = item.c_id === "F" ? "F" :
                           item.c_id === "C" || item.c_id === 6 ? "C" :
                           item.c_id === "L" || item.c_id === 5 ? "L" :
                           item.c_id === "W" ? "W" : null;
          
          if (sectionId) {
            setOpenedSubCategories((prev) => ({
              ...prev,
              [sectionId]: subCategory.id,
            }));
          }
        }
      }
    }
  }, [id]);

  // Note: setConstrFromCalcToSent is called manually when needed, not in useEffect to avoid infinite loops

  const handleBack = () => {
    if (hasHistory()) {
      navigate(-2);
    } else {
      navigate("/");
    }
  };

  // Debug: проверяем, что компонент рендерится
  console.log("Calculator rendering", {
    currentCategory,
    getActiveCategories: getActiveCategories?.length,
  });

  // Основные секции
  const mainSections = [
    { id: "F", title: "ПОЛ", icon: "../../../Img_constr/icon_floor_white.svg" },
    { id: "C", title: "ПОТОЛОК", icon: "../../../Img_constr/icon_ceiling_white.svg" },
    { id: "L", title: "ОБЛИЦОВКА", icon: "../../../Img_constr/icon_frame_white.svg" },
    { id: "W", title: "ПЕРЕГОРОДКА", icon: "../../../Img_constr/icon_partition_white.svg" },
  ];

  // Проверяем, есть ли открытые секции
  const hasOpenedSections = Object.values(openedSubCategories).some(
    (value) => value !== null
  );

  return (
    <div>
      <div className="content-calc" style={{ height: "100vh" }}>
        <div className="main-content">
          {/* Четыре секции */}
          {mainSections.map((section) => {
            const subCategories = getSubCategoriesForSection(section.id);
            const openedSubCategory = openedSubCategories[section.id];
            const items = openedSubCategory
              ? getItemsForSection(section.id, openedSubCategory)
              : [];

            return (
              <div 
                key={section.id} 
                className="section-container"
                onClick={() => handleSectionClick(section.id, subCategories)}
                style={{ cursor: 'pointer' }}
              >
                <div className="section-header">
                  <h2 className="section-title">
                    <img src={section.icon} alt="" className="section-icon" />
                    {section.title}
                  </h2>
                </div>

                {/* Список items для открытой подкатегории */}
                {openedSubCategory && (
                  <div 
                    className="items content-item"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {items.length > 0 ? items.map((elem) => {
                      const isSelected = currentItems == elem.id;
                      return (
                        <div key={`${elem.id}-${elem.c_id}`}>
                          <button
                            value={elem.id}
                            className={isSelected ? "const_active" : "const_page"}
                            onClick={() => handleItemSelect(elem)}
                          >
                            <p
                              style={{
                                zIndex: 1,
                                color: "revert",
                                pointerEvents: "none",
                              }}
                            >
                              {elem.title}
                            </p>
                            {!isSelected && (
                              <img
                                src={`../../../${elem.img}`}
                                alt=""
                                className="img-icon"
                              />
                            )}
                          </button>
                        </div>
                      );
                    }) : (
                      <div style={{ padding: "20px", textAlign: "center", color: "#878181" }}>
                        Нет элементов в этой подкатегории
                      </div>
                    )}
                  </div>
                )}

                {/* Блок с формами, кнопкой расчета и таблицами - открывается при выборе элемента */}
                {currentItems != 0 && (() => {
                  const selectedItem = items.find((el) => el.id == currentItems);
                  // Показываем блок только если выбранный элемент принадлежит этой секции
                  if (!selectedItem || selectedItem.c_id !== openedSubCategory) return null;
                  
                  return (
                    <div 
                      ref={selectedItemContainerRef}
                      className="selected-item-container" 
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="selected-item-forms">
                        {/* Формы конструкций для выбранного элемента */}
                        {/* Полы: template 1, 111, 3, 607.1, 608.1, 609.1, 610.1, 2.1, 9, 9.1 */}
                        {(selectedItem.template == 1 ||
                          selectedItem.template == 111 ||
                          selectedItem.template == 3 ||
                          selectedItem.template == 607.1 ||
                          selectedItem.template == 608.1 ||
                          selectedItem.template == 609.1 ||
                          selectedItem.template == 610.1 ||
                          selectedItem.template == 2.1 ||
                          selectedItem.template == 9 ||
                          selectedItem.template == 9.1) && (
                          <div className="inputsFloorAll">
                            <h4 style={{ margin: "5px" }}>
                              размер конструкции
                            </h4>
                            <input
                              type="number"
                              placeholder="ширина,мм"
                              value={constR.lenX || ""}
                              onChange={(e) =>
                                setConstR({ ...constR, lenX: e.target.value })
                              }
                            />
                            <input
                              type="number"
                              placeholder="длина,мм"
                              value={constR.lenY || ""}
                              onChange={(e) =>
                                setConstR({ ...constR, lenY: e.target.value })
                              }
                            />
                          </div>
                        )}

                        {/* Потолки: template 4, 5 */}
                        {(selectedItem.template == 4 || selectedItem.template == 5) && (
                          <div className="ceiling">
                            <h4 style={{ margin: "5px" }}>
                              размер конструкции
                            </h4>
                            <input
                              type="number"
                              placeholder="ширина,мм"
                              value={constR.lenX || ""}
                              onChange={(e) =>
                                setConstR({ ...constR, lenX: e.target.value })
                              }
                            />
                            <input
                              type="number"
                              placeholder="длина,мм"
                              value={constR.lenY || ""}
                              onChange={(e) =>
                                setConstR({ ...constR, lenY: e.target.value })
                              }
                            />
                            {selectedItem.template == 5 && (
                              <input
                                type="number"
                                placeholder="смещение потолка,мм"
                                value={constR.AddCeilShift || ""}
                                onChange={(e) =>
                                  setConstR({
                                    ...constR,
                                    AddCeilShift: e.target.value,
                                  })
                                }
                              />
                            )}
                          </div>
                        )}

                        {/* Облицовка и перегородки: template 6, 50, 75, 100, 101, 50.1, 75.1, 100.1, 101.1, 50.2, 75.2, 100.2, 8.1 */}
                        {(selectedItem.template == 6 ||
                          selectedItem.template == 50 ||
                          selectedItem.template == 75 ||
                          selectedItem.template == 100 ||
                          selectedItem.template == 101 ||
                          selectedItem.template == 50.1 ||
                          selectedItem.template == 75.1 ||
                          selectedItem.template == 100.1 ||
                          selectedItem.template == 101.1 ||
                          selectedItem.template == 50.2 ||
                          selectedItem.template == 75.2 ||
                          selectedItem.template == 100.2 ||
                          selectedItem.template == 8.1) && (
                          <div
                            className={
                              selectedItem.c_id == "W" ? "partittion50" : "frame50"
                            }
                          >
                            <h4 style={{ margin: "5px" }}>
                              размер конструкции
                            </h4>
                            <input
                              type="number"
                              placeholder="ширина,мм"
                              value={constR.lenX || ""}
                              onChange={(e) =>
                                setConstR({ ...constR, lenX: e.target.value })
                              }
                            />
                            <input
                              type="number"
                              placeholder="высота,мм"
                              value={constR.lenZ || ""}
                              onChange={(e) =>
                                setConstR({ ...constR, lenZ: e.target.value })
                              }
                            />
                            <button
                              className="counter__button_param"
                              style={{ marginBottom: "10px" }}
                              onClick={getStartParam}
                            >
                              
                              параметры конструкции
                            </button>
                            {unvisible && (
                              <div
                                style={{
                                  display: "contents",
                                  top: "10px",
                                  marginBottom: "20px",
                                }}
                              >
                                <input
                                  className="radio"
                                  type="radio"
                                  onChange={(e) =>
                                    setProfileStep(e.target.value)
                                  }
                                  id={`step600_${selectedItem.id}`}
                                  name={`steps_${selectedItem.id}`}
                                  value="600"
                                  checked={profileStep == 600}
                                />
                                <label className="label">
                                  шаг профиля 600 мм
                                </label>
                                <input
                                  className="radio"
                                  type="radio"
                                  onChange={(e) =>
                                    setProfileStep(e.target.value)
                                  }
                                  id={`step400_${selectedItem.id}`}
                                  name={`steps_${selectedItem.id}`}
                                  value="400"
                                  checked={profileStep == 400}
                                />
                                <label className="label">
                                  шаг профиля 400 мм
                                </label>
                                <input
                                  className="radio"
                                  type="radio"
                                  onChange={(e) =>
                                    setProfileStep(e.target.value)
                                  }
                                  id={`step300_${selectedItem.id}`}
                                  name={`steps_${selectedItem.id}`}
                                  value="300"
                                  checked={profileStep == 300}
                                />
                                <label className="label">
                                  шаг профиля 300 мм
                                </label>
                                <input
                                  className="checkbox"
                                  type="checkbox"
                                  onChange={(e) => setDFrame(e.target.checked)}
                                  id={`dframe_${selectedItem.id}`}
                                  checked={dFrame}
                                />
                                <label className="label">
                                  добавить сдвоенный каркас
                                </label>
                                <hr />
                                <h4 style={{ margin: "1px" }}>размер проема</h4>
                                <input
                                  type="number"
                                  placeholder="ширина проема,мм"
                                  value={opening.lenX || ""}
                                  onChange={(e) =>
                                    setOpening({
                                      ...opening,
                                      lenX: e.target.value,
                                    })
                                  }
                                />
                                <input
                                  type="number"
                                  placeholder="высота проема,мм"
                                  value={opening.lenZ || ""}
                                  onChange={(e) =>
                                    setOpening({
                                      ...opening,
                                      lenZ: e.target.value,
                                    })
                                  }
                                />
                                <h4 style={{ margin: "1px" }}>тип проема</h4>
                                <input
                                  className="radio"
                                  type="radio"
                                  onChange={(e) =>
                                    setOpening({
                                      ...opening,
                                      Type: e.target.value,
                                    })
                                  }
                                  id={`doors_${selectedItem.id}`}
                                  name={`opening_${selectedItem.id}`}
                                  value="OST_Doors"
                                  checked={opening.Type == "OST_Doors"}
                                />
                                <label className="label">дверь</label>
                                <input
                                  className="radio"
                                  type="radio"
                                  onChange={(e) =>
                                    setOpening({
                                      ...opening,
                                      Type: e.target.value,
                                    })
                                  }
                                  id={`wind_${selectedItem.id}`}
                                  name={`opening_${selectedItem.id}`}
                                  value="OST_Windows"
                                  checked={opening.Type == "OST_Windows"}
                                />
                                <label className="label">окно</label>
                                <button
                                  className="counter__button_param"
                                  style={{ right: "2px" }}
                                  onClick={addOpening}
                                >
                                  добавить проем
                                </button>
                                {constrSent.Openings.length > 0 && (
                                  <div>
                                    {constrSent.Openings.map((op, idx) => (
                                      <div key={idx}>
                                        {getOpeningType(op.Type)}: {op.lenX} x{" "}
                                        {op.lenZ} мм
                                        <button
                                          onClick={() => delFromOpenings(idx)}
                                        >
                                          удалить
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* SOUNDBOARD: template 201, 202 */}
                        {(selectedItem.template == 201 || selectedItem.template == 202) && (
                          <div className="inputsFloorAll">
                            <h4 style={{ margin: "5px" }}>
                              размер конструкции
                            </h4>
                            {selectedItem.c_id == "5" ? (
                              <>
                                <input
                                  type="number"
                                  placeholder="ширина,мм"
                                  value={constR.lenX || ""}
                                  onChange={(e) =>
                                    setConstR({
                                      ...constR,
                                      lenX: e.target.value,
                                    })
                                  }
                                />
                                <input
                                  type="number"
                                  placeholder="высота,мм"
                                  value={constR.lenZ || ""}
                                  onChange={(e) =>
                                    setConstR({
                                      ...constR,
                                      lenZ: e.target.value,
                                    })
                                  }
                                />
                              </>
                            ) : (
                              <>
                                <input
                                  type="number"
                                  placeholder="ширина,мм"
                                  value={constR.lenX || ""}
                                  onChange={(e) =>
                                    setConstR({
                                      ...constR,
                                      lenX: e.target.value,
                                    })
                                  }
                                />
                                <input
                                  type="number"
                                  placeholder="длина,мм"
                                  value={constR.lenY || ""}
                                  onChange={(e) =>
                                    setConstR({
                                      ...constR,
                                      lenY: e.target.value,
                                    })
                                  }
                                />
                              </>
                            )}
                          </div>
                          )}

                          {/* Кнопка расчета конструкций для выбранного элемента */}
                          {selectedItem.template != null && (
                            <div>
                              <button
                                onClick={addConstrToCalc}
                                className="counter__button_plus"
                              >
                                расчет конструкции
                              </button>
                            </div>
                          )}

                          {/* Кнопки экспорта */}
                          {template != null && (
                            <div className="buttons-container">
                              <button
                                onClick={copyTableToClipboard}
                                className="add_design_button"
                              >
                                экспорт в ERP
                              </button>
                              <button onClick={tableToExcel} className="add_design_button">
                                сохранить в Excel
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Блок таблиц и кнопок - показывается после нажатия кнопки "расчет конструкции" */}
                        <div className="tables-and-buttons-container">
                          {tableConstrToCalc != null && ConstrToCalc.length > 0 && (
                            <>
                            <div className="tbl-in">
                              {/* <hr style={{ opacity: 0.1 }} /> */}
                              <table className="data" id="table1">
                <thead>
                  <tr>
                    <th
                      colSpan="5"
                      style={{
                        fontSize: "14px",
                        fontWeight: "bold",
                        textAlign: "center",
                      }}
                    >
                      cписок конструкций
                    </th>
                  </tr>
                  <tr>
                    <th>шифр</th>
                    <th>название</th>
                    <th>масса</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {ConstrToCalc.map((constRItem) => (
                    <tr key={constRItem.key_id}>
                      <td style={{ textAlign: "right" }}>{constRItem.ag_id}</td>
                      <td style={{ textAlign: "center" }}>
                        {constRItem.title} ,{constRItem.lenX} x {constRItem.lenY}{" "}
                        {constRItem.lenZ} мм
                      </td>
                      <td>{constRItem.weight}</td>
                      <td>
                        <input
                          type="button"
                          className="counter__button_minus"
                          onClick={() => delConstrFromList(constRItem.key_id)}
                        />
                        <img
                          src={`${import.meta.env.BASE_URL}delete-icon.jpg`}
                          alt=""
                          style={{ height: "30px", opacity: 0.7 }}
                          onClick={() => delConstrFromList(constRItem.key_id)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="tbl-in">
              <table className="data" id="table2">
                <thead>
                  <tr>
                    <th
                      colSpan="5"
                      style={{
                        fontSize: "14px",
                        fontWeight: "bold",
                        textAlign: "center",
                      }}
                    >
                      cписок материалов
                    </th>
                  </tr>
                  <tr>
                    <th>артикул</th>
                    <th>название</th>
                    <th style={{ display: "none" }}></th>
                    <th>кол-во</th>
                    <th>ед.изм</th>
                  </tr>
                </thead>
                <tbody>
                  {calculatedMaterials &&
                  calculatedMaterials.data &&
                  calculatedMaterials.data.length > 0 ? (
                    calculatedMaterials.data.map((Material, index) => (
                      <tr key={index}>
                        <td>{filterVariable(Material.Code)}</td>
                        <td>{Material.Name}</td>
                        <td style={{ display: "none" }}></td>
                        <td>{convertUnits(Material)}</td>
                        <td>{Material.Units}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan="5"
                        style={{ textAlign: "center", padding: "20px" }}
                      >
                        {calculatedMaterials
                          ? "Нет данных для отображения"
                          : "Загрузка..."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Calculator;
