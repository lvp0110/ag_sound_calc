import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Modal from "./Modal";
import "./Calculator.css";
import SubCategories from "../data/subCategories";
import Items, { getItemsWithApiImages } from "../data/items";
import mainSections from "../data/mainSections";
import {
  constRZero,
  constSentZero,
  openingZero,
} from "../constants/defaultValues";
import { getImageUrl } from "../services/api";
import { getResponsiveImageProps } from "../utils/responsiveImages";
import { validateInput, validateFloorInput, validateFloorMaxInput, getMaxLenZInMeters } from "../utils/validation";
import { calculateAreaAndPerimeter, getConstructionCode } from "../utils/calculations";
import { getOpeningType } from "../utils/formatters";
import { exportTablesToExcel, copyMaterialsToClipboard } from "../utils/excelExport";
import {
  CALCULATOR_STATE_STORAGE_KEY,
  migrateMaterialsFromSavedState,
} from "../constants/calculatorSession";
import { calculateConstruction } from "../services/constructionApi";
import ItemsList from "./ItemsList";
import SelectedItemForms from "./SelectedItemForms";
import ConstructionList from "./tables/ConstructionList";

const Calculator = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  // Функция для загрузки состояния из sessionStorage
  const loadStateFromStorage = () => {
    try {
      const savedState = sessionStorage.getItem(CALCULATOR_STATE_STORAGE_KEY);
      if (savedState) {
        return JSON.parse(savedState);
      }
    } catch (error) {
      // Игнорируем ошибки парсинга
    }
    return null;
  };

  // Функция для сохранения состояния в sessionStorage
  const saveStateToStorage = (state) => {
    try {
      sessionStorage.setItem(
        CALCULATOR_STATE_STORAGE_KEY,
        JSON.stringify(state)
      );
    } catch (error) {
      // Игнорируем ошибки сохранения
    }
  };

  // Загружаем сохраненное состояние
  const savedState = loadStateFromStorage();

  // State
  const [currentGkla, setCurrentGkla] = useState(savedState?.currentGkla || "default");
  const [currentWool, setCurrentWool] = useState(savedState?.currentWool || "default");
  const [unvisible, setUnvisible] = useState(savedState?.unvisible || false);
  const [tableConstrToCalc, setTableConstrToCalc] = useState(savedState?.tableConstrToCalc || null);
  const [currentSubCategory, setCurrentSubCategory] = useState(savedState?.currentSubCategory || 0);
  const [currentItems, setCurrentItems] = useState(savedState?.currentItems || 0);
  // Состояние для отслеживания открытых подкатегорий в каждой секции
  const [openedSubCategories, setOpenedSubCategories] = useState(savedState?.openedSubCategories || {
    F: null, // null или id подкатегории
    C: null,
    L: null,
    W: null,
  });
  const [template, setTemplate] = useState(savedState?.template || null);
  const [profileStep, setProfileStep] = useState(savedState?.profileStep || 600);
  const [dFrame, setDFrame] = useState(savedState?.dFrame || false);
  const [currentConstr, setCurrentConstr] = useState(savedState?.currentConstr || "");
  const [ConstrToCalcToSent, setConstrToCalcToSent] = useState(savedState?.ConstrToCalcToSent || []);
  const [ConstrToCalc, setConstrToCalc] = useState(savedState?.ConstrToCalc || []);
  const [materialsByConstruction, setMaterialsByConstruction] = useState(() =>
    migrateMaterialsFromSavedState(savedState)
  );
  const [itemsWithImages, setItemsWithImages] = useState(Items); // Начальное значение - базовые items

  // Состояние для модального окна
  const [modal, setModal] = useState({
    isOpen: false,
    title: null,
    html: null,
    icon: null,
    imageUrl: null,
    imageWidth: null,
    imageHeight: null,
    confirmButtonText: "OK",
    confirmButtonColor: "#6cabc8",
  });

  // Загружаем items с изображениями из API при монтировании компонента
  useEffect(() => {
    const loadItemsWithImages = async () => {
      try {
        const enrichedItems = await getItemsWithApiImages();
        setItemsWithImages(enrichedItems);
        
        // Если есть сохраненное состояние с открытой секцией, предзагружаем первое изображение
        const savedState = loadStateFromStorage();
        if (savedState?.openedSubCategories) {
          const firstOpenedSection = mainSections.find(section => {
            const openedSubCategory = savedState.openedSubCategories[section.id];
            if (!openedSubCategory) return false;
            const sectionItems = enrichedItems.filter((el) => el.c_id == openedSubCategory);
            return sectionItems.length > 0;
          });
          
          if (firstOpenedSection) {
            const openedSubCategory = savedState.openedSubCategories[firstOpenedSection.id];
            const sectionItems = enrichedItems.filter((el) => el.c_id == openedSubCategory);
            
            if (sectionItems.length > 0) {
              const firstItem = sectionItems[0];
              const firstImageSrc = firstItem.Img || firstItem.img;
              
              if (firstImageSrc) {
                const firstImageUrl = getImageUrl(firstImageSrc);
                
                // Добавляем preload link для максимального приоритета
                const link = document.createElement('link');
                link.rel = 'preload';
                link.as = 'image';
                link.href = firstImageUrl;
                link.setAttribute('fetchpriority', 'high');
                link.setAttribute('data-lcp-candidate', 'true');
                document.head.appendChild(link);
                
                // Также предзагружаем через Image API
                const img = new Image();
                img.fetchPriority = 'high';
                img.src = firstImageUrl;
              }
            }
          }
        }
      } catch (error) {
        // В случае ошибки используем базовые items
        setItemsWithImages(Items);
      }
    };

    loadItemsWithImages();
  }, []);

  // Сохраняем состояние в sessionStorage при изменении критических данных
  useEffect(() => {
    const stateToSave = {
      currentGkla,
      currentWool,
      unvisible,
      tableConstrToCalc,
      currentSubCategory,
      currentItems,
      openedSubCategories,
      template,
      profileStep,
      dFrame,
      currentConstr,
      ConstrToCalcToSent,
      ConstrToCalc,
      materialsByConstruction,
    };
    saveStateToStorage(stateToSave);
  }, [
    currentGkla,
    currentWool,
    unvisible,
    tableConstrToCalc,
    currentSubCategory,
    currentItems,
    openedSubCategories,
    template,
    profileStep,
    dFrame,
    currentConstr,
    ConstrToCalcToSent,
    ConstrToCalc,
    materialsByConstruction,
  ]);

  // Получить items для конкретной секции и подкатегории
  const getItemsForSection = useCallback(
    (sectionId, subCategoryId) => {
      if (!subCategoryId) return [];
      return itemsWithImages.filter((el) => el.c_id == subCategoryId);
    },
    [itemsWithImages]
  );

  // Предзагружаем иконки секций для улучшения производительности
  useEffect(() => {
    const sectionIcons = mainSections.map(section => getImageUrl(section.icon));
    
    // Загружаем первую иконку с высоким приоритетом
    if (sectionIcons.length > 0) {
      const img = new Image();
      img.fetchPriority = 'high';
      if (!import.meta.env.DEV) {
        img.crossOrigin = 'anonymous';
      }
      img.src = sectionIcons[0];
    }
    
    // Загружаем остальные иконки
    sectionIcons.slice(1).forEach((url) => {
      const img = new Image();
      if (!import.meta.env.DEV) {
        img.crossOrigin = 'anonymous';
      }
      img.src = url;
    });
  }, []);

  // Предзагружаем первое изображение из открытой секции для улучшения LCP
  useEffect(() => {
    if (itemsWithImages.length === 0) return;
    
    const firstOpenedSection = mainSections.find(section => {
      const openedSubCategory = openedSubCategories[section.id];
      if (!openedSubCategory) return false;
      const sectionItems = getItemsForSection(section.id, openedSubCategory);
      return sectionItems.length > 0;
    });

    if (firstOpenedSection) {
      const openedSubCategory = openedSubCategories[firstOpenedSection.id];
      const sectionItems = getItemsForSection(firstOpenedSection.id, openedSubCategory);
      
      if (sectionItems.length > 0) {
        const firstItem = sectionItems[0];
        const firstImageSrc = firstItem.Img || firstItem.img;
        
        if (firstImageSrc) {
          const firstImageUrl = getImageUrl(firstImageSrc);
          
          // Удаляем предыдущий preload link если есть
          const existingLink = document.querySelector('link[rel="preload"][as="image"][data-lcp-candidate="true"]');
          if (existingLink) {
            existingLink.remove();
          }
          
          // Добавляем preload link для максимального приоритета загрузки
          const link = document.createElement('link');
          link.rel = 'preload';
          link.as = 'image';
          link.href = firstImageUrl;
          link.setAttribute('fetchpriority', 'high');
          link.setAttribute('data-lcp-candidate', 'true');
          document.head.appendChild(link);
          
          // Также предзагружаем через Image API
          const img = new Image();
          img.fetchPriority = 'high';
          img.src = firstImageUrl;
        }
      }
    }
  }, [openedSubCategories, itemsWithImages, getItemsForSection]);

  const [constR, setConstR] = useState({
    title: "",
    type: "",
    lenX: null,
    lenY: null,
    lenZ: null,
    description: "",
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

  // Обработчик клика на секцию (section-container)
  const handleSectionClick = useCallback((sectionId, subCategories) => {
    setOpenedSubCategories((prev) => {
      const currentOpened = prev[sectionId];

      // Если секция уже открыта - закрыть её
      if (currentOpened) {
        return { F: null, C: null, L: null, W: null, [sectionId]: null };
      }

      // Если секция закрыта - открыть первую подкатегорию и закрыть все остальные
      if (subCategories && subCategories.length > 0) {
        const firstSubCategory = subCategories[0];
        setCurrentSubCategory(firstSubCategory.id);
        // Закрываем все секции и открываем только выбранную
        return {
          F: null,
          C: null,
          L: null,
          W: null,
          [sectionId]: firstSubCategory.id,
        };
      }

      return prev;
    });
  }, []);

  // Обработчик выбора элемента
  const handleItemSelect = useCallback(
    (item) => {
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
        // Устанавливаем currentSubCategory на основе c_id элемента
        if (item.c_id) {
          setCurrentSubCategory(item.c_id);
        }
      }
    },
    [currentItems]
  );

  // Обновляем template и другие параметры при изменении currentItems
  useEffect(() => {
    if (currentItems != 0) {
      const selectedItem = itemsWithImages.find((el) => el.id == currentItems);
      if (selectedItem) {
        setTemplate(selectedItem.template);
        setTableConstrToCalc(1);
        setCurrentConstr(selectedItem.ag_id);
      }
    } else {
      setTemplate(null);
      // setVisible(false);
      setCurrentConstr("");
    }
  }, [currentItems, itemsWithImages]);

  // Прокрутка к selected-item-container при выборе элемента
  useEffect(() => {
    if (currentItems != 0) {
      requestAnimationFrame(() => {
        const container = document.querySelector(".selected-item-container");
        if (container) {
          container.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
      });
    }
  }, [currentItems]);

  const delFromOpenings = (index) => {
    const newOpenings = [...constrSent.Openings];
    newOpenings.splice(index, 1);
    setConstrSent({ ...constrSent, Openings: newOpenings });
  };

  const addOpening = () => {
    setConstrSent({
      ...constrSent,
      Openings: [...constrSent.Openings, { ...opening }],
    });
    setOpening({ ...openingZero });
  };

  const getStartParam = () => {
    setUnvisible(!unvisible);
  };

  const delConstrFromList = (idConstr) => {
    const indexToDel = ConstrToCalc.findIndex((el) => el.key_id == idConstr);
    if (indexToDel < 0) return;
    const newConstrToCalc = [...ConstrToCalc];
    const newConstrToCalcToSent = [...ConstrToCalcToSent];
    newConstrToCalc.splice(indexToDel, 1);
    newConstrToCalcToSent.splice(indexToDel, 1);
    setConstrToCalc(newConstrToCalc);
    setConstrToCalcToSent(newConstrToCalcToSent);
    setMaterialsByConstruction((prev) =>
      prev.filter((_, i) => i !== indexToDel)
    );
  };

  // Восстанавливаем расчёт по каждой конструкции отдельно (без суммирования материалов)
  useEffect(() => {
    if (ConstrToCalcToSent.length === 0 || ConstrToCalc.length === 0) return;

    const aligned =
      materialsByConstruction.length === ConstrToCalc.length &&
      ConstrToCalcToSent.length === ConstrToCalc.length &&
      ConstrToCalc.every(
        (c, i) => materialsByConstruction[i]?.key_id === c.key_id
      );
    const hasAnyMaterials = materialsByConstruction.some(
      (m) => Array.isArray(m.data) && m.data.length > 0
    );
    if (aligned && hasAnyMaterials) return;

    let cancelled = false;

    (async () => {
      try {
        const results = [];
        for (let i = 0; i < ConstrToCalcToSent.length; i++) {
          const r = await calculateConstruction([ConstrToCalcToSent[i]]);
          if (cancelled) return;
          results.push({
            key_id: ConstrToCalc[i].key_id,
            data: r?.data ?? [],
          });
        }
        if (!cancelled) setMaterialsByConstruction(results);
      } catch (error) {
        let errorMessage = error.message;
        if (error.message.includes("invalid construction size")) {
          errorMessage =
            "Неверный размер конструкции. Пожалуйста, проверьте введенные размеры. Для ЗИПС потолка минимальный размер составляет 200 мм.";
        } else if (error.message.includes("404")) {
          errorMessage =
            "Сервер API недоступен. Проверьте подключение к интернету или обратитесь к администратору.";
        }

        setModal({
          isOpen: true,
          title: "Ошибка",
          html: `Не удалось рассчитать материалы.<br><br>${errorMessage}<br><br>Проверьте консоль для деталей.`,
          icon: "error",
          imageUrl: null,
          imageWidth: null,
          imageHeight: null,
          confirmButtonText: "OK",
          confirmButtonColor: "#6cabc8",
        });
        if (!cancelled) setMaterialsByConstruction([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- восстановление из sessionStorage один раз при монтировании

  // Обработчики экспорта
  const handleExportToExcel = async () => {
    await exportTablesToExcel();
  };

  const handleCopyToClipboard = () => {
    copyMaterialsToClipboard();
  };

  const handleMakeKP = () => {
    navigate("/kp");
  };

  const addConstrToCalc = useCallback(async () => {
    // Валидация входных данных
    const inputError = validateInput(
      constR,
      currentSubCategory,
      currentItems,
      template,
      profileStep,
      itemsWithImages
    );

    if (inputError) {
      setModal({
        isOpen: true,
        title: null,
        html: inputError,
        icon: null,
        imageWidth: 60,
        imageHeight: 50,
        imageUrl: `${import.meta.env.BASE_URL}logo1.png`,
        confirmButtonText: "OK",
        confirmButtonColor: "#6cabc8",
      });
      return;
    }

    // Валидация для полов
    const floorError = validateFloorInput(constR, currentSubCategory, template);
    if (floorError) {
      setModal({
        isOpen: true,
        title: null,
        html: floorError,
        icon: null,
        imageWidth: 60,
        imageHeight: 50,
        imageUrl: `${import.meta.env.BASE_URL}logo1.png`,
        confirmButtonText: "Ok",
        confirmButtonColor: "#6cabc8",
      });
      return;
    }

    // Валидация максимальных размеров для полов
    const floorMaxError = validateFloorMaxInput(constR, currentSubCategory, template);
    if (floorMaxError) {
      setModal({
        isOpen: true,
        title: null,
        html: floorMaxError,
        icon: null,
        imageWidth: 60,
        imageHeight: 50,
        imageUrl: `${import.meta.env.BASE_URL}logo1.png`,
        confirmButtonText: "Принять",
        confirmButtonColor: "#6cabc8",
      });
      return;
    }

    // Если все проверки прошли, добавляем конструкцию
    const IconType = SubCategories.find((el) => el.id == currentSubCategory);
    const Constr = itemsWithImages.find((el) => el.id == currentItems);

    const newConstR = {
      ...constR,
      imgBlack: IconType?.imgBlack ? getImageUrl(IconType.imgBlack) : undefined,
      description: Constr?.description,
      key_id: Date.now(),
      title: Constr?.title,
      type: IconType?.title,
      ag_id: Constr?.ag_id,
      step: Constr?.step,
      weight: Constr?.weight,
    };

    // Получаем код конструкции
    const code = getConstructionCode(currentConstr, currentGkla, currentWool);

    // Вычисляем площадь и периметр
    const lenX = +constR.lenX || 0;
    const lenY = +constR.lenY || 0;
    const lenZ = +constR.lenZ || 0;
    const { area, perimeter } = calculateAreaAndPerimeter(
      lenX,
      lenY,
      lenZ,
      currentSubCategory
    );

    // Преобразуем проемы: lenX и lenZ должны быть числами, а не строками
    const openingsWithNumbers = constrSent.Openings.map((opening) => ({
      ...opening,
      lenX: +opening.lenX || 0,
      lenZ: +opening.lenZ || 0,
    }));

    const newConstrSent = {
      Code: code,
      LenX: lenX,
      LenY: lenY,
      LenZ: lenZ,
      AddCeilShift: +constR.AddCeilShift || 0,
      step: +profileStep,
      dframe: dFrame,
      Area: area,
      Perimeter: perimeter,
      Openings: openingsWithNumbers,
    };

    if (code == "AG.L401" || code == "AG.W101" || code == "AG.W105") {
      newConstrSent.dframe = true;
    }
    if (
      (code == "AG.F615" || code == "AG.F615_vibroflex_LD") &&
      profileStep === 600
    ) {
      newConstrSent.step = 400;
    }

    const deep = JSON.parse(JSON.stringify(newConstrSent));

    try {
      const result = await calculateConstruction([deep]);
      const data = result?.data ?? [];

      setConstrToCalcToSent((prev) => [...prev, deep]);
      setConstrToCalc((prev) => [...prev, newConstR]);
      setMaterialsByConstruction((prev) => [
        ...prev,
        { key_id: newConstR.key_id, data },
      ]);
      setConstrSent({ ...constSentZero });
      setOpening({ ...openingZero });
      setConstR({ ...constRZero });
      setDFrame(false);
      setUnvisible(false);
      setProfileStep(600);
      setCurrentGkla("default");
      setCurrentWool("default");

      requestAnimationFrame(() => {
        const constructionTable = document.getElementById("table1");
        if (constructionTable) {
          constructionTable.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
      });
    } catch (error) {
      let errorMessage = error.message;
      if (error.message.includes("invalid construction size")) {
        errorMessage =
          "Неверный размер конструкции. Пожалуйста, проверьте введенные размеры. Для ЗИПС потолка минимальный размер составляет 200 мм.";
      } else if (error.message.includes("404")) {
        errorMessage =
          "Сервер API недоступен. Проверьте подключение к интернету или обратитесь к администратору.";
      }

      setModal({
        isOpen: true,
        title: "Ошибка",
        html: `Не удалось рассчитать материалы.<br><br>${errorMessage}<br><br>Проверьте консоль для деталей.`,
        icon: "error",
        imageUrl: null,
        imageWidth: null,
        imageHeight: null,
        confirmButtonText: "OK",
        confirmButtonColor: "#6cabc8",
      });
    }
  }, [
    constR,
    currentSubCategory,
    currentItems,
    itemsWithImages,
    profileStep,
    dFrame,
    constrSent,
    currentGkla,
    currentWool,
    template,
  ]);

  // Обработчик клавиши Enter для кнопки "расчет конструкции"
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Проверяем, что нажата клавиша Enter
      if (event.key === "Enter" || event.keyCode === 13) {
        // Проверяем, что кнопка видна (template не null)
        if (template != null) {
          // Проверяем, что модальное окно не открыто
          if (!modal.isOpen) {
            // Проверяем, что фокус не на textarea или других элементах, где Enter имеет другое значение
            const activeElement = document.activeElement;
            const isInputField =
              activeElement &&
              (activeElement.tagName === "INPUT" ||
                activeElement.tagName === "TEXTAREA");

            // Если фокус на input (но не textarea), разрешаем Enter для расчета
            // Если фокус на textarea, не перехватываем Enter
            if (!isInputField || activeElement.tagName === "INPUT") {
              event.preventDefault();
              addConstrToCalc();
            }
          }
        }
      }
    };

    // Добавляем обработчик события
    window.addEventListener("keydown", handleKeyDown);

    // Удаляем обработчик при размонтировании компонента
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [template, modal.isOpen, addConstrToCalc]); // Зависимости: template, modal.isOpen и addConstrToCalc

  // Initialize from route params
  useEffect(() => {
    // Если id есть в URL, устанавливаем соответствующий элемент
    // Это имеет приоритет над сохраненным состоянием
    if (id != null && itemsWithImages.length > 0) {
      const item = itemsWithImages.find((item) => item.ag_id === id);
      if (item) {
        const subCategory = SubCategories.find(
          (subCategory) => subCategory.id === item.c_id
        );
        if (subCategory) {
          setCurrentItems(item.id);
          setCurrentSubCategory(subCategory.id);

          // Определяем секцию по c_id и открываем соответствующую подкатегорию
          const sectionId =
            item.c_id === "F"
              ? "F"
              : item.c_id === "C" || item.c_id === 6
              ? "C"
              : item.c_id === "L" || item.c_id === 5
              ? "L"
              : item.c_id === "W"
              ? "W"
              : null;

          if (sectionId) {
            // Закрываем все секции и открываем только нужную
            setOpenedSubCategories({
              F: null,
              C: null,
              L: null,
              W: null,
              [sectionId]: subCategory.id,
            });
          }
        }
      }
    }
  }, [id, itemsWithImages]);

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
                style={{ cursor: "pointer" }}
              >
                <div className="section-header">
                  <h2 className="section-title">
                    <img
                      {...getResponsiveImageProps(section.icon, 'section')}
                      alt=""
                      className="section-icon"
                      loading="eager"
                      decoding="async"
                      fetchPriority={section.id === "F" ? "high" : "auto"}
                      width="80"
                      height="80"
                      crossOrigin={import.meta.env.DEV ? undefined : "anonymous"}
                      onError={(e) => {
                        // Если изображение не загрузилось, пробуем альтернативный путь
                        if (!e.target.dataset.fallbackTried) {
                          e.target.dataset.fallbackTried = 'true';
                          // Пробуем загрузить через прямой URL API
                          const fallbackUrl = getImageUrl(section.icon);
                          const img = new Image();
                          img.onload = () => {
                            e.target.src = fallbackUrl;
                          };
                          img.onerror = () => {
                            // Если и альтернативный путь не работает, скрываем иконку
                            e.target.style.display = 'none';
                          };
                          img.src = fallbackUrl;
                        } else {
                          // Если уже пробовали альтернативный путь, скрываем иконку
                          e.target.style.display = 'none';
                        }
                      }}
                    />
                    {section.title}
                  </h2>
                </div>

                {/* Список items для открытой подкатегории */}
                {openedSubCategory && (
                  <div
                    className="items content-item"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {items.length > 0 ? (
                      items.map((elem, index) => {
                        const imageSrc = elem.Img || elem.img;
                        const imageProps = imageSrc
                          ? getResponsiveImageProps(imageSrc, 'item')
                          : null;

                        const isSelected = currentItems == elem.id;
                        const buttonClassName = [
                          "const_page",
                          isSelected ? "const_page--selected" : null,
                        ]
                          .filter(Boolean)
                          .join(" ");

                        // Первые 4 изображения загружаем eagerly для улучшения LCP
                        // Первое изображение получает высокий приоритет
                        const isAboveTheFold = index < 4;
                        const isLCPCandidate = index === 0;
                        const loadingStrategy = isAboveTheFold ? "eager" : "lazy";
                        const fetchPriority = isLCPCandidate ? "high" : isAboveTheFold ? "auto" : undefined;
                        // Для LCP элемента используем синхронный декодинг для быстрого отображения
                        const decodingStrategy = isLCPCandidate ? "sync" : "async";

                        return (
                          <div
                            key={`${elem.id}-${elem.c_id}`}
                            className="const-item-container"
                          >
                            {/* Кнопка const_page */}
                            <button
                              value={elem.id}
                              className={buttonClassName}
                              onClick={() => handleItemSelect(elem)}
                            >
                              <p>{elem.title}</p>
                              {imageProps && imageProps.src && (
                                <img 
                                  {...imageProps}
                                  alt="" 
                                  className="img-icon"
                                  loading={loadingStrategy}
                                  decoding={decodingStrategy}
                                  fetchPriority={fetchPriority}
                                  width="200"
                                  height="200"
                                  onError={(e) => {
                                    // Специальный fallback для zips_ceiling: пробуем без папки
                                    if (
                                      imageSrc &&
                                      imageSrc.includes("zips_ceiling/") &&
                                      !e.target.dataset.retried
                                    ) {
                                      const fileName = imageSrc.split("zips_ceiling/").pop();
                                      if (fileName) {
                                        e.target.dataset.retried = "true";
                                        const fallbackProps = getResponsiveImageProps(fileName, 'item');
                                        e.target.src = fallbackProps.src;
                                        if (fallbackProps.srcSet) e.target.srcSet = fallbackProps.srcSet;
                                        if (fallbackProps.sizes) e.target.sizes = fallbackProps.sizes;
                                        return;
                                      }
                                    }
                                    // Пробуем загрузить через прямой URL
                                    if (imageSrc) {
                                      const fallbackUrl = getImageUrl(imageSrc);
                                      const img = new Image();
                                      img.onload = () => {
                                        e.target.src = fallbackUrl;
                                      };
                                      img.onerror = () => {
                                        e.target.style.display = 'none';
                                      };
                                      img.src = fallbackUrl;
                                    } else {
                                      e.target.style.display = 'none';
                                    }
                                  }}
                                />
                              )}
                            </button>
                          </div>
                        );
                      })
                    ) : (
                      <div
                        style={{
                          padding: "20px",
                          textAlign: "center",
                          color: "#878181",
                        }}
                      >
                        Нет элементов в этой подкатегории
                      </div>
                    )}
                  </div>
                )}

                {/* Блок с формами, кнопкой расчета и таблицами - открывается при выборе элемента */}
                {currentItems != 0 &&
                  (() => {
                    const selectedItem = items.find(
                      (el) => el.id == currentItems
                    );
                    // Показываем блок только если выбранный элемент принадлежит этой секции
                    if (
                      !selectedItem ||
                      selectedItem.c_id !== openedSubCategory
                    )
                      return null;

                    return (
                      <div
                        // Закомментировано: неиспользуемый ref
                        className="selected-item-container"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="selected-item-forms">
                          <div className="selected-item-header">
                            <h3>{selectedItem.title}</h3>
                            <button 
                              className="info-button" 
                              onClick={() => {
                                // Сохраняем c_id в sessionStorage для передачи в ItemInfo
                                sessionStorage.setItem('itemInfo_c_id', selectedItem.c_id);
                                navigate(`/info/${selectedItem.ag_id}`, { state: { c_id: selectedItem.c_id } });
                              }}
                              aria-label="Информация"
                              title="Информация"
                            >
                              <svg 
                                width="20" 
                                height="20" 
                                viewBox="0 0 20 20" 
                                fill="none" 
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="2" fill="none"/>
                                <text x="10" y="14" textAnchor="middle" fontSize="14" fontWeight="bold" fill="currentColor" fontStyle="italic">i</text>
                              </svg>
                            </button>
                          </div>
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
                          {(selectedItem.template == 4 ||
                            selectedItem.template == 5) && (
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
                              {selectedItem.template == 5 &&
                                selectedItem.id == 503 && (
                                  <input
                                    type="number"
                                    placeholder="смещение от потолка,мм"
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
                                selectedItem.c_id == "W"
                                  ? "partittion50"
                                  : "frame50"
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
                                параметры
                              </button>
                              {unvisible &&
                                (() => {
                                  // Проверяем, является ли это ЗИПС облицовкой (стеной)
                                  const isZIPSFacing =
                                    selectedItem.ag_id &&
                                    selectedItem.ag_id.startsWith("AG.Z") &&
                                    selectedItem.c_id == "L";

                                  return (
                                    <div
                                      style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        top: "10px",
                                        marginBottom: "20px",
                                        width: "100%",
                                      }}
                                    >
                                      <h4
                                        style={{
                                          background: "lightgray",
                                          padding: 4,
                                        }}
                                      >
                                        выбрать тип гипсокартона
                                      </h4>
                                      <div
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          marginBottom: "4px",
                                        }}
                                      >
                                        <input
                                          className="radio"
                                          type="radio"
                                          onChange={(e) =>
                                            setCurrentGkla(e.target.value)
                                          }
                                          id={`gkla_default_${selectedItem.id}`}
                                          name={`gkla_${selectedItem.id}`}
                                          value="default"
                                          checked={currentGkla == "default"}
                                        />
                                        <label
                                          className="label"
                                          htmlFor={`gkla_default_${selectedItem.id}`}
                                        >
                                          AKU-line 2500x1200x12,5 мм
                                        </label>
                                      </div>
                                      <div
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          marginBottom: "4px",
                                        }}
                                      >
                                        <input
                                          className="radio"
                                          type="radio"
                                          onChange={(e) =>
                                            setCurrentGkla(e.target.value)
                                          }
                                          id={`gkla_2500P_${selectedItem.id}`}
                                          name={`gkla_${selectedItem.id}`}
                                          value="2500P"
                                          checked={currentGkla == "2500P"}
                                        />
                                        <label
                                          className="label"
                                          htmlFor={`gkla_2500P_${selectedItem.id}`}
                                        >
                                          AKU-line Pro 2500x1200x12,5 мм
                                        </label>
                                      </div>
                                      <div
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          marginBottom: "4px",
                                        }}
                                      >
                                        <input
                                          className="radio"
                                          type="radio"
                                          onChange={(e) =>
                                            setCurrentGkla(e.target.value)
                                          }
                                          id={`gkla_2000_${selectedItem.id}`}
                                          name={`gkla_${selectedItem.id}`}
                                          value="2000"
                                          checked={currentGkla == "2000"}
                                        />
                                        <label
                                          className="label"
                                          htmlFor={`gkla_2000_${selectedItem.id}`}
                                        >
                                          AKU-line 2000x1200x12,5 мм
                                        </label>
                                      </div>

                                      {!isZIPSFacing && (
                                        <>
                                          <h4
                                            style={{
                                              background: "lightgray",
                                              padding: 4,
                                            }}
                                          >
                                            выбрать тип минваты
                                          </h4>
                                          <div
                                            style={{
                                              display: "flex",
                                              alignItems: "center",
                                              marginBottom: "4px",
                                            }}
                                          >
                                            <input
                                              className="radio"
                                              type="radio"
                                              onChange={(e) =>
                                                setCurrentWool(e.target.value)
                                              }
                                              id={`wool_default_${selectedItem.id}`}
                                              name={`wool_${selectedItem.id}`}
                                              value="default"
                                              checked={currentWool == "default"}
                                            />
                                            <label
                                              className="label"
                                              htmlFor={`wool_default_${selectedItem.id}`}
                                            >
                                              Шуманет-Эко
                                            </label>
                                          </div>
                                          <div
                                            style={{
                                              display: "flex",
                                              alignItems: "center",
                                              marginBottom: "4px",
                                            }}
                                          >
                                            <input
                                              className="radio"
                                              type="radio"
                                              onChange={(e) =>
                                                setCurrentWool(e.target.value)
                                              }
                                              id={`wool_bm_${selectedItem.id}`}
                                              name={`wool_${selectedItem.id}`}
                                              value="bm"
                                              checked={currentWool == "bm"}
                                            />
                                            <label
                                              className="label"
                                              htmlFor={`wool_bm_${selectedItem.id}`}
                                            >
                                              Шуманет-БМ
                                            </label>
                                          </div>
                                          <div
                                            style={{
                                              display: "flex",
                                              alignItems: "center",
                                              marginBottom: "4px",
                                            }}
                                          >
                                            <input
                                              className="radio"
                                              type="radio"
                                              onChange={(e) =>
                                                setCurrentWool(e.target.value)
                                              }
                                              id={`wool_sk_${selectedItem.id}`}
                                              name={`wool_${selectedItem.id}`}
                                              value="skNeo"
                                              checked={currentWool == "skNeo"}
                                            />
                                            <label
                                              className="label"
                                              htmlFor={`wool_sk_${selectedItem.id}`}
                                            >
                                              Шуманет-СК Neo
                                            </label>
                                          </div>
                                        </>
                                      )}

                                      {!isZIPSFacing && (
                                        <>
                                          <h4
                                            style={{
                                              background: "lightgray",
                                              padding: 4,
                                            }}
                                          >
                                            шаг профиля
                                          </h4>
                                          <div
                                            style={{
                                              fontSize: "12px",
                                              color: "#666",
                                              marginBottom: "5px",
                                            }}
                                          >
                                            ✔ шаг профиля при облицовке
                                            керамической плиткой не более 400 мм
                                          </div>
                                          <div
                                            style={{
                                              display: "flex",
                                              alignItems: "center",
                                              marginBottom: "4px",
                                            }}
                                          >
                                            <input
                                              className="radio"
                                              type="radio"
                                              onChange={(e) =>
                                                setProfileStep(Number(e.target.value))
                                              }
                                              id={`step600_${selectedItem.id}`}
                                              name={`steps_${selectedItem.id}`}
                                              value="600"
                                              checked={profileStep === 600}
                                            />
                                            <label
                                              className="label"
                                              htmlFor={`step600_${selectedItem.id}`}
                                            >
                                              шаг профиля 600 мм{" "}
                                              {(() => {
                                                const maxHeight =
                                                  getMaxLenZInMeters(
                                                    selectedItem.id,
                                                    600,
                                                    currentSubCategory
                                                  );
                                                return maxHeight
                                                  ? `(макс.высота конструкции ${maxHeight} м)`
                                                  : "";
                                              })()}
                                            </label>
                                          </div>
                                          <div
                                            style={{
                                              display: "flex",
                                              alignItems: "center",
                                              marginBottom: "4px",
                                            }}
                                          >
                                            <input
                                              className="radio"
                                              type="radio"
                                              onChange={(e) =>
                                                setProfileStep(Number(e.target.value))
                                              }
                                              id={`step400_${selectedItem.id}`}
                                              name={`steps_${selectedItem.id}`}
                                              value="400"
                                              checked={profileStep === 400}
                                            />
                                            <label
                                              className="label"
                                              htmlFor={`step400_${selectedItem.id}`}
                                            >
                                              шаг профиля 400 мм{" "}
                                              {(() => {
                                                const maxHeight =
                                                  getMaxLenZInMeters(
                                                    selectedItem.id,
                                                    400,
                                                    currentSubCategory
                                                  );
                                                return maxHeight
                                                  ? `(макс.высота конструкции ${maxHeight} м)`
                                                  : "";
                                              })()}
                                            </label>
                                          </div>
                                          <div
                                            style={{
                                              display: "flex",
                                              alignItems: "center",
                                              marginBottom: "4px",
                                            }}
                                          >
                                            <input
                                              className="radio"
                                              type="radio"
                                              onChange={(e) =>
                                                setProfileStep(Number(e.target.value))
                                              }
                                              id={`step300_${selectedItem.id}`}
                                              name={`steps_${selectedItem.id}`}
                                              value="300"
                                              checked={profileStep === 300}
                                            />
                                            <label
                                              className="label"
                                              htmlFor={`step300_${selectedItem.id}`}
                                            >
                                              шаг профиля 300 мм{" "}
                                              {(() => {
                                                const maxHeight =
                                                  getMaxLenZInMeters(
                                                    selectedItem.id,
                                                    300,
                                                    currentSubCategory
                                                  );
                                                return maxHeight
                                                  ? `(макс.высота конструкции ${maxHeight} м)`
                                                  : "";
                                              })()}
                                            </label>
                                          </div>
                                        </>
                                      )}
                                      {!isZIPSFacing && (
                                        <div
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            marginBottom: "4px",
                                          }}
                                        >
                                          <input
                                            className="checkbox"
                                            type="checkbox"
                                            onChange={(e) =>
                                              setDFrame(e.target.checked)
                                            }
                                            id={`dframe_${selectedItem.id}`}
                                            checked={dFrame}
                                          />
                                          <label
                                            className="label"
                                            htmlFor={`dframe_${selectedItem.id}`}
                                          >
                                            добавить сдвоенный каркас
                                          </label>
                                        </div>
                                      )}
                                      <h4
                                        style={{
                                          background: "lightgray",
                                          padding: 4,
                                        }}
                                      >
                                        размер проема
                                      </h4>
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
                                      <h4 style={{ margin: "1px" }}>
                                        тип проема
                                      </h4>
                                      <div
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          marginBottom: "4px",
                                        }}
                                      >
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
                                        <label
                                          className="label"
                                          htmlFor={`doors_${selectedItem.id}`}
                                        >
                                          дверь
                                        </label>
                                      </div>
                                      <div
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          marginBottom: "4px",
                                        }}
                                      >
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
                                          checked={
                                            opening.Type == "OST_Windows"
                                          }
                                        />
                                        <label
                                          className="label"
                                          htmlFor={`wind_${selectedItem.id}`}
                                        >
                                          окно
                                        </label>
                                      </div>
                                      <button
                                        className="counter__button_param"
                                        style={{ right: "2px" }}
                                        onClick={addOpening}
                                        disabled={
                                          !opening.lenX ||
                                          !opening.lenZ ||
                                          isNaN(+opening.lenX) ||
                                          isNaN(+opening.lenZ) ||
                                          +opening.lenX <= 0 ||
                                          +opening.lenZ <= 0
                                        }
                                      >
                                        добавить проем
                                      </button>
                                      {constrSent.Openings.length > 0 && (
                                        <div
                                          className="tbl-in"
                                          style={{
                                            marginTop: "10px",
                                            width: "100%",
                                          }}
                                        >
                                          <table
                                            className="data"
                                            // style={{ width: "100%" }}
                                          >
                                            <thead>
                                              <tr>
                                                <th
                                                  colSpan="3"
                                                  style={{
                                                    fontSize: "14px",
                                                    fontWeight: "bold",
                                                    textAlign: "center",
                                                  }}
                                                >
                                                  список проемов
                                                </th>
                                              </tr>
                                              <tr>
                                                <th>тип проема</th>
                                                <th>размеры, мм</th>
                                                <th></th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {constrSent.Openings.map(
                                                (op, idx) => (
                                                  <tr key={idx}>
                                                    <td
                                                      style={{
                                                        textAlign: "center",
                                                      }}
                                                    >
                                                      {getOpeningType(op.Type)}
                                                    </td>
                                                    <td
                                                      style={{
                                                        textAlign: "center",
                                                      }}
                                                    >
                                                      {op.lenX} x {op.lenZ}
                                                    </td>
                                                    <td>
                                                      <input
                                                        type="button"
                                                        className="counter__button_minus"
                                                        onClick={() =>
                                                          delFromOpenings(idx)
                                                        }
                                                      />
                                                      <img
                                                        src={`${
                                                          import.meta.env
                                                            .BASE_URL
                                                        }delete-icon.jpg`}
                                                        alt=""
                                                        loading="lazy"
                                                        decoding="async"
                                                        style={{
                                                          height: "30px",
                                                          opacity: 0.7,
                                                          cursor: "pointer",
                                                        }}
                                                        onClick={() =>
                                                          delFromOpenings(idx)
                                                        }
                                                      />
                                                    </td>
                                                  </tr>
                                                )
                                              )}
                                            </tbody>
                                          </table>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                            </div>
                          )}

                          {/* SOUNDBOARD: template 201, 202 */}
                          {(selectedItem.template == 201 ||
                            selectedItem.template == 202) && (
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
                            <>
                              <div className="buttons-container">
                                <button
                                  onClick={handleCopyToClipboard}
                                  className="add_design_button"
                                >
                                  экспорт в ERP
                                </button>
                                <button
                                  onClick={handleExportToExcel}
                                  className="add_design_button"
                                >
                                  сохранить в Excel
                                </button>
                              </div>
                              <div className="kp-button-row">
                                <button
                                  type="button"
                                  onClick={handleMakeKP}
                                  className="add_design_button"
                                >
                                  Сделать КП
                                </button>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Блок таблиц и кнопок - показывается после нажатия кнопки "расчет конструкции" */}
                        <div className="tables-and-buttons-container">
                          {tableConstrToCalc != null &&
                            ConstrToCalc.length > 0 && (
                              <ConstructionList
                                constructions={ConstrToCalc}
                                onDelete={delConstrFromList}
                              />
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
      <Modal
        isOpen={modal.isOpen}
        onClose={() => setModal({ ...modal, isOpen: false })}
        title={modal.title}
        html={modal.html}
        icon={modal.icon}
        imageUrl={modal.imageUrl}
        imageWidth={modal.imageWidth}
        imageHeight={modal.imageHeight}
        confirmButtonText={modal.confirmButtonText}
        confirmButtonColor={modal.confirmButtonColor}
      />
    </div>
  );
};

export default Calculator;
