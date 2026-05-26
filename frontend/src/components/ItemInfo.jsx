import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import Items, { getItemsWithApiImages } from "../data/items";
import {
  getImageUrl,
  getConstructionByCode,
  getIsolationConstrMaterials,
  loadInfoPageMaterialsList,
} from "../services/api";
import { getResponsiveImageProps } from "../utils/responsiveImages";
import "./Calculator.css";

// Мапа CAD изображений (чертежей) для потолков ЗИПС
const zipsCeilingCadImages = {
  201: "cad_ceiling_zips_vector.png",
  202: "cad_ceiling_zips_module.png",
  203: "cad_ceiling_zips_IIIultra.png",
  204: "cad_ceiling_zips_Z4.png",
  205: "cad_ceiling_zips_cinema.png",
};

const ItemInfo = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [item, setItem] = useState(null);
  const [constructionData, setConstructionData] = useState(null);
  const [materials, setMaterials] = useState(null);
  const [loading, setLoading] = useState(true);
  const [materialsExpanded, setMaterialsExpanded] = useState(false);
  /** Код материала из строки списка (constr_materials), для которого раскрыты детали с API */
  const [expandedMaterialLineCode, setExpandedMaterialLineCode] = useState(null);
  const [materialIsolationDetail, setMaterialIsolationDetail] = useState(null);
  const [materialIsolationLoading, setMaterialIsolationLoading] = useState(false);
  const [materialIsolationError, setMaterialIsolationError] = useState(null);
  const [zipsItems, setZipsItems] = useState(null); // Оба варианта ЗИПС (потолок и облицовка)
  const [currentImageIndex, setCurrentImageIndex] = useState(0); // Индекс текущего изображения в слайдере
  const [currentCadIndex, setCurrentCadIndex] = useState(0); // Индекс текущего чертежа в слайдере
  const initialIndexSet = useRef(false); // Флаг для отслеживания, были ли установлены начальные индексы
  const selectedCIdRef = useRef(null);   // c_id из location.state, запоминаем до настройки индексов слайдера
  const materialsSectionRef = useRef(null);

  // Загружаем данные элемента и конструкции из API
  useEffect(() => {
    const loadData = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      try {
        // Загружаем items для получения базовой информации
        const itemsWithImages = await getItemsWithApiImages();

        // В базе дублируются ЗИПСы для стен и потолков с одинаковым ag_id.
        const sameAgItems = itemsWithImages.filter((item) => item.ag_id === id);
        // Сбрасываем флаг при загрузке нового элемента
        initialIndexSet.current = false;
        
        // Определяем секцию из location.state (приходит из navigate(..., { state: { c_id } }))
        const navigationCId = location.state?.c_id || null;

        // Если есть navigationCId, используем его для выбора элемента.
        // Иначе выбираем по умолчанию (сначала облицовку, потом потолок).
        let foundItem;
        if (navigationCId) {
          foundItem = sameAgItems.find((item) => item.c_id === navigationCId) || sameAgItems[0] || null;
          selectedCIdRef.current = navigationCId;
        } else {
          foundItem = sameAgItems.find((item) => item.c_id === "L") ||
            sameAgItems.find((item) => item.c_id === "C") ||
            sameAgItems[0] ||
            null;
        }
        
        if (foundItem) {
          setItem(foundItem);
          
          // Для ЗИПС (id 201-205) получаем оба варианта (потолок и облицовка)
          const isZIPS = [201, 202, 203, 204, 205].includes(foundItem.id);
          let constructionRecord = null;

          if (isZIPS) {
            const ceilingItem = sameAgItems.find((item) => item.c_id === "C");
            const liningItem = sameAgItems.find((item) => item.c_id === "L");
            
            // Загружаем данные конструкций для обоих вариантов
            const [ceilingConstruction, liningConstruction] = await Promise.all([
              ceilingItem ? getConstructionByCode(ceilingItem.ag_id) : null,
              liningItem ? getConstructionByCode(liningItem.ag_id) : null,
            ]);
            
            // Сохраняем оба варианта для слайдера
            setZipsItems({
              ceiling: ceilingItem,
              lining: liningItem,
              ceilingConstruction,
              liningConstruction,
            });
            
            constructionRecord =
              foundItem.c_id === "C" ? ceilingConstruction : liningConstruction;
            setConstructionData(constructionRecord);
            
            // Сохраняем c_id для установки индексов после формирования массивов
            // Индексы будут установлены в useEffect после формирования imageSources и cadImageSources
          } else {
            setZipsItems(null);
            constructionRecord = await getConstructionByCode(id);
            setConstructionData(constructionRecord);
          }
          
          // Загружаем материалы конструкции: шифр из загруженной конструкции или ag_id элемента
          const codeToUse = constructionRecord?.Code || foundItem.ag_id || id;
          if (codeToUse) {
            const list = await loadInfoPageMaterialsList(codeToUse);
            setMaterials(list?.length ? list : null);
          }
        }
      } catch {
        // Игнорируем ошибки загрузки
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

  // Сбрасываем флаг при изменении id
  useEffect(() => {
    initialIndexSet.current = false;
  }, [id]);

  useEffect(() => {
    setExpandedMaterialLineCode(null);
    setMaterialIsolationDetail(null);
    setMaterialIsolationError(null);
    setMaterialIsolationLoading(false);
  }, [id]);

  useEffect(() => {
    if (!materialsExpanded) return;
    const el = materialsSectionRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [materialsExpanded]);

  // Устанавливаем начальные индексы слайдера после загрузки данных
  useEffect(() => {
    if (zipsItems && item && !initialIndexSet.current && [201, 202, 203, 204, 205].includes(item.id)) {
      // Проверяем, что данные загружены
      const hasCeilingImage = zipsItems.ceiling && (zipsItems.ceiling.Img || zipsItems.ceiling.img || zipsItems.ceilingConstruction?.Img);
      const hasLiningImage = zipsItems.lining && (zipsItems.lining.Img || zipsItems.lining.img || zipsItems.liningConstruction?.Img);
      const hasCeilingCad = zipsItems.ceiling && zipsItems.ceiling.id && zipsCeilingCadImages[zipsItems.ceiling.id];
      const hasLiningCad = zipsItems.lining && (zipsItems.liningConstruction?.CadImg);
      
      // Используем c_id, который мы запомнили в ref при первом рендере (пришёл из location.state).
      const selectedCId = selectedCIdRef.current || item.c_id;

      if ((hasCeilingImage || hasLiningImage) && (hasCeilingCad || hasLiningCad)) {
        // Если перешли из секции потолок (c_id === "C"), показываем потолок первым (индекс 0)
        // Если перешли из секции облицовка (c_id === "L"), показываем облицовку первой
        if (selectedCId === "C") {
          // Потолок идет первым в массиве, индекс 0
          setCurrentImageIndex(0);
          setCurrentCadIndex(0);
        } else if (selectedCId === "L") {
          // Облицовка идет второй в массиве (индекс 1), если потолок есть
          const imageIndex = hasCeilingImage ? 1 : 0;
          const cadIndex = hasCeilingCad ? 1 : 0;
          setCurrentImageIndex(imageIndex);
          setCurrentCadIndex(cadIndex);
        }
        initialIndexSet.current = true;
        selectedCIdRef.current = null;
      }
    }
  }, [item, zipsItems]);

  if (loading) {
    return (
      <div className="item-info-container">
        <div className="item-info-content">
          <p>Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="item-info-container">
        <div className="item-info-content">
          <h2>Элемент не найден</h2>
          <button
            onClick={() => navigate("/calc")}
            className="counter__button_plus"
            style={{ marginTop: "20px" }}
          >
            Вернуться к калькулятору
          </button>
        </div>
      </div>
    );
  }

  // Получаем данные из API или используем данные из item как fallback
  const data = constructionData || {};

  /** Шифр конструкции для GET …/IsolationConstrMaterials/{code} (тот же, что в примере AG.W101) */
  const isolationConstrCodeForMaterialsApi =
    data.Code || item.ag_id || id;

  const handleMaterialLineClick = async (material) => {
    const lineCode = material.code || material.Code;
    if (!lineCode) return;
    if (!isolationConstrCodeForMaterialsApi) {
      setMaterialIsolationError("Не задан шифр конструкции для запроса.");
      return;
    }

    if (expandedMaterialLineCode === lineCode) {
      setExpandedMaterialLineCode(null);
      setMaterialIsolationDetail(null);
      setMaterialIsolationError(null);
      return;
    }

    setExpandedMaterialLineCode(lineCode);
    setMaterialIsolationDetail(null);
    setMaterialIsolationError(null);
    setMaterialIsolationLoading(true);

    const res = await getIsolationConstrMaterials(isolationConstrCodeForMaterialsApi);
    setMaterialIsolationLoading(false);

    if (!res) {
      setMaterialIsolationError("Не удалось загрузить данные материала.");
      return;
    }

    const arr = Array.isArray(res.data) ? res.data : null;
    if (!arr?.length) {
      setMaterialIsolationError("Для этой конструкции нет подробных данных.");
      return;
    }

    const found = arr.find(
      (row) => String(row.Code ?? row.code) === String(lineCode)
    );
    if (!found) {
      setMaterialIsolationError("Материал не найден в ответе сервера.");
      return;
    }

    setMaterialIsolationDetail(found);
  };
  
  // Для ЗИПС получаем оба изображения (потолок и облицовка)
  const isZIPS = zipsItems && (zipsItems.ceiling || zipsItems.lining);
  
  let imageSources = [];
  let cadImageSources = [];
  
  if (isZIPS) {
    // Для ЗИПС получаем оба варианта изображений
    if (zipsItems.ceiling) {
      const ceilingImg = zipsItems.ceiling.Img || zipsItems.ceiling.img || zipsItems.ceilingConstruction?.Img;
      if (ceilingImg) imageSources.push({ src: ceilingImg, label: "Потолок" });
    }
    if (zipsItems.lining) {
      const liningImg = zipsItems.lining.Img || zipsItems.lining.img || zipsItems.liningConstruction?.Img;
      if (liningImg) imageSources.push({ src: liningImg, label: "Облицовка" });
    }
    
    // Для чертежей также получаем оба варианта
    // Для потолка используем чертеж из мапы zipsCeilingCadImages
    if (zipsItems.ceiling && zipsItems.ceiling.id && zipsCeilingCadImages[zipsItems.ceiling.id]) {
      const ceilingCadImageName = zipsCeilingCadImages[zipsItems.ceiling.id];
      const ceilingCadImg = getImageUrl(ceilingCadImageName);
      cadImageSources.push({ src: ceilingCadImg, label: "Потолок" });
    }
    // Для облицовки используем CadImg из API
    if (zipsItems.lining) {
      const liningCadImg = zipsItems.liningConstruction?.CadImg || data.CadImg;
      if (liningCadImg) {
        cadImageSources.push({ src: liningCadImg, label: "Облицовка" });
      }
    }
  } else {
    // Для остальных элементов используем стандартную логику
    const imgSrc = item.Img || item.img || data.Img;
    if (imgSrc) imageSources.push({ src: imgSrc, label: "" });
    
    if (data.CadImg) cadImageSources.push({ src: data.CadImg, label: "" });
  }
  
  // Получаем текущие изображения для отображения
  const currentImage = imageSources[currentImageIndex] || imageSources[0];
  const currentCadImage = cadImageSources[currentCadIndex] || cadImageSources[0];
  
  const imgProps = currentImage ? getResponsiveImageProps(currentImage.src, "item") : null;
  const cadImgProps = currentCadImage ? getResponsiveImageProps(currentCadImage.src, "item") : null;

  return (
    <div className="item-info-container">
      <div className="item-info-content">
        <button
          onClick={() => navigate("/calc")}
          className="counter__button_plus"
          style={{ marginBottom: "20px" }}
        >
           ◁ Назад к калькулятору
        </button>

        <div className="item-info-header">
          <h1>{item.title}</h1>
        </div>

        <div className="item-info-layout">
          <div className="item-info-images-column">
            {/* Слайдер для изображений конструкций */}
            {imgProps && imgProps.src && imageSources.length > 0 && (
              <div className="item-info-image">
                <div className="item-info-swiper">
                  {imageSources.length > 1 && (
                    <div className="item-info-swiper-controls">
                      <button
                        className="item-info-swiper-button item-info-swiper-button-prev"
                        onClick={() => setCurrentImageIndex((prev) => (prev === 0 ? imageSources.length - 1 : prev - 1))}
                        aria-label="Предыдущее изображение"
                      >
                        ‹
                      </button>
                      <div className="item-info-swiper-pagination">
                        {imageSources.map((_, index) => (
                          <span
                            key={index}
                            className={`item-info-swiper-pagination-bullet ${index === currentImageIndex ? 'active' : ''}`}
                            onClick={() => setCurrentImageIndex(index)}
                            aria-label={`Изображение ${index + 1}`}
                          />
                        ))}
                      </div>
                      <button
                        className="item-info-swiper-button item-info-swiper-button-next"
                        onClick={() => setCurrentImageIndex((prev) => (prev === imageSources.length - 1 ? 0 : prev + 1))}
                        aria-label="Следующее изображение"
                      >
                        ›
                      </button>
                    </div>
                  )}
                  {currentImage.label && (
                    <div className="item-info-swiper-label">{currentImage.label}</div>
                  )}
                  <img
                    {...getResponsiveImageProps(currentImage.src, "item")}
                    alt={`${item.title}${currentImage.label ? ` - ${currentImage.label}` : ''}`}
                    className="item-info-img"
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      const fallbackUrl = getImageUrl(currentImage.src);
                      const img = new Image();
                      img.onload = () => {
                        e.target.src = fallbackUrl;
                      };
                      img.onerror = () => {
                        e.target.style.display = "none";
                      };
                      img.src = fallbackUrl;
                    }}
                  />
                </div>
              </div>
            )}

            {/* Слайдер для чертежей (CAD) */}
            {cadImgProps && cadImgProps.src && cadImageSources.length > 0 && (
              <div className="item-info-image">
                <div className="item-info-swiper">
                  {cadImageSources.length > 1 && (
                    <div className="item-info-swiper-controls">
                      <button
                        className="item-info-swiper-button item-info-swiper-button-prev"
                        onClick={() => setCurrentCadIndex((prev) => (prev === 0 ? cadImageSources.length - 1 : prev - 1))}
                        aria-label="Предыдущий чертеж"
                      >
                        ‹
                      </button>
                      <div className="item-info-swiper-pagination">
                        {cadImageSources.map((_, index) => (
                          <span
                            key={index}
                            className={`item-info-swiper-pagination-bullet ${index === currentCadIndex ? 'active' : ''}`}
                            onClick={() => setCurrentCadIndex(index)}
                            aria-label={`Чертеж ${index + 1}`}
                          />
                        ))}
                      </div>
                      <button
                        className="item-info-swiper-button item-info-swiper-button-next"
                        onClick={() => setCurrentCadIndex((prev) => (prev === cadImageSources.length - 1 ? 0 : prev + 1))}
                        aria-label="Следующий чертеж"
                      >
                        ›
                      </button>
                    </div>
                  )}
                  {currentCadImage.label && (
                    <div className="item-info-swiper-label">{currentCadImage.label}</div>
                  )}
                  <img
                    {...getResponsiveImageProps(currentCadImage.src, "item")}
                    alt={`${item.title} - CAD${currentCadImage.label ? ` - ${currentCadImage.label}` : ''}`}
                    className="item-info-img"
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      const fallbackUrl = getImageUrl(currentCadImage.src);
                      const img = new Image();
                      img.onload = () => {
                        e.target.src = fallbackUrl;
                      };
                      img.onerror = () => {
                        e.target.style.display = "none";
                      };
                      img.src = fallbackUrl;
                    }}
                  />
                </div>
              </div>
            )}

            {/* Список материалов */}
            {(() => {
              // materials уже содержит массив материалов из constr_materials объекта с type: "Materials"
              const materialsToDisplay = materials && Array.isArray(materials) && materials.length > 0 ? materials : null;
              
              if (materialsToDisplay && Array.isArray(materialsToDisplay) && materialsToDisplay.length > 0) {
                return (
                  <div
                    className="item-info-materials"
                    ref={materialsSectionRef}
                  >
                    <h3 
                      onClick={() => setMaterialsExpanded(!materialsExpanded)}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                      className="item-info-materials-toggle"
                    >
                      Состав конструкции
                      <span className="item-info-materials-arrow">
                        {materialsExpanded ? ' ▼' : ' ▶'}
                      </span>
                    </h3>
                    {materialsExpanded && (
                      <ul className="item-info-materials-list">
                      {materialsToDisplay
                        .filter((material) => {
                          // Фильтруем только объекты с code и name (настоящие материалы)
                          return (
                            typeof material === 'object' &&
                            material !== null &&
                            (material.code || material.Code || material.name || material.Name)
                          );
                        })
                        .map((material, index) => {
                          // Материалы из constr_materials имеют структуру: {code: "...", name: "..."}
                          const name = material.name || material.Name || '';
                          
                          // Выводим только название материала
                          const displayText = name || 'Неизвестный материал';
                          const lineCode = material.code || material.Code;
                          const isOpen =
                            lineCode &&
                            expandedMaterialLineCode === lineCode;

                          return (
                            <li
                              key={lineCode ? String(lineCode) : index}
                              className="item-info-material-item"
                            >
                              <button
                                type="button"
                                className="item-info-material-trigger"
                                onClick={() => handleMaterialLineClick(material)}
                                disabled={!lineCode}
                                aria-expanded={Boolean(isOpen)}
                              >
                                {displayText}
                              </button>
                              {isOpen && (
                                <div
                                  className="item-info-material-isolation-panel"
                                  role="region"
                                  aria-live="polite"
                                >
                                  {materialIsolationLoading && (
                                    <p className="item-info-material-isolation-status">
                                      Загрузка…
                                    </p>
                                  )}
                                  {!materialIsolationLoading &&
                                    materialIsolationError && (
                                      <p className="item-info-material-isolation-error">
                                        {materialIsolationError}
                                      </p>
                                    )}
                                  {!materialIsolationLoading &&
                                    !materialIsolationError &&
                                    materialIsolationDetail && (
                                      <div className="item-info-material-isolation-body">
                                        {(materialIsolationDetail.Name ||
                                          materialIsolationDetail.name) && (
                                          <h4 className="item-info-material-isolation-title">
                                            {materialIsolationDetail.Name ||
                                              materialIsolationDetail.name}
                                          </h4>
                                        )}
                                        {(materialIsolationDetail.Code ||
                                          materialIsolationDetail.code) && (
                                          <p className="item-info-material-isolation-meta">
                                            <span className="item-info-material-isolation-label">
                                              Код:{" "}
                                            </span>
                                            {materialIsolationDetail.Code ||
                                              materialIsolationDetail.code}
                                          </p>
                                        )}
                                        {(materialIsolationDetail.Img ||
                                          materialIsolationDetail.img) && (
                                          <div className="item-info-material-isolation-img-wrap">
                                            <img
                                              src={getImageUrl(
                                                materialIsolationDetail.Img ||
                                                  materialIsolationDetail.img
                                              )}
                                              alt=""
                                              className="item-info-material-isolation-img"
                                              loading="lazy"
                                              decoding="async"
                                            />
                                          </div>
                                        )}
                                        {(materialIsolationDetail.Description ||
                                          materialIsolationDetail.description) && (
                                          <div className="item-info-material-isolation-block">
                                            <span className="item-info-material-isolation-label">
                                              Описание
                                            </span>
                                            <p>
                                              {materialIsolationDetail.Description ||
                                                materialIsolationDetail.description}
                                            </p>
                                          </div>
                                        )}
                                        {(materialIsolationDetail.Specification ||
                                          materialIsolationDetail.specification) && (
                                          <div className="item-info-material-isolation-block">
                                            <span className="item-info-material-isolation-label">
                                              Характеристики и применение
                                            </span>
                                            <p>
                                              {materialIsolationDetail.Specification ||
                                                materialIsolationDetail.specification}
                                            </p>
                                          </div>
                                        )}
                                        {[
                                          [
                                            "Размеры (Д×Ш×В), мм",
                                            (() => {
                                              const L =
                                                materialIsolationDetail.Length ??
                                                materialIsolationDetail.length;
                                              const W =
                                                materialIsolationDetail.Width ??
                                                materialIsolationDetail.width;
                                              const H =
                                                materialIsolationDetail.Height ??
                                                materialIsolationDetail.height;
                                              if (
                                                [L, W, H].every(
                                                  (v) =>
                                                    v == null ||
                                                    v === "" ||
                                                    Number(v) === 0
                                                )
                                              ) {
                                                return null;
                                              }
                                              return `${L ?? "—"} × ${W ?? "—"} × ${H ?? "—"}`;
                                            })(),
                                          ],
                                          [
                                            "Единица",
                                            materialIsolationDetail.Units ||
                                              materialIsolationDetail.units,
                                          ],
                                          [
                                            "Упаковка",
                                            materialIsolationDetail.InfoPack ||
                                              materialIsolationDetail.infoPack,
                                          ],
                                          [
                                            "Тип",
                                            materialIsolationDetail.Type ||
                                              materialIsolationDetail.type,
                                          ],
                                        ].map(([label, value]) =>
                                          value ? (
                                            <p
                                              key={label}
                                              className="item-info-material-isolation-row"
                                            >
                                              <span className="item-info-material-isolation-label">
                                                {label}:{" "}
                                              </span>
                                              {value}
                                            </p>
                                          ) : null
                                        )}
                                      </div>
                                    )}
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              }
              return null;
            })()}
          </div>

          <div className="item-info-details">
          {/* Code */}
          {data.Code && (
            <div className="item-info-section">
              <h3>Шифр конструкции</h3>
              <p>{data.Code}</p>
            </div>
          )}

          {/* Description */}
          {data.Description && (
            <div className="item-info-section">
              <h3>Название</h3>
              <p>{data.Description}</p>
            </div>
          )}

          {/* Thickness */}
          {data.Thickness && (
            <div className="item-info-section">
              <h3>Толщина, мм</h3>
              <p>{data.Thickness}</p>
            </div>
          )}

          {/* SoundIndex */}
          {data.SoundIndex && (
            <div className="item-info-section">
              <h3>Индекс звукоизоляции воздушного шума, Rw</h3>
              <p>{data.SoundIndex}</p>
            </div>
          )}

          {/* ImpactNoseIndex - только если есть и не равен 0 */}
          {data.ImpactNoseIndex !== undefined && data.ImpactNoseIndex !== null && data.ImpactNoseIndex !== 0 && (
            <div className="item-info-section">
              <h3>Индекс звукоизоляции ударного шума, Lnw</h3>
              <p>{data.ImpactNoseIndex}</p>
            </div>
          )}

          {/* Specification */}
          {data.Specification && (
            <div className="item-info-section">
              <h3>Описание</h3>
              <p>{data.Specification}</p>
            </div>
          )}
          </div>
        </div>

        <button
          onClick={() => navigate(`/calc/${item.ag_id}`)}
          className="counter__button_plus"
          style={{ marginTop: "30px" }}
        >
          Перейти к расчету
        </button>
      </div>
    </div>
  );
};

export default ItemInfo;

