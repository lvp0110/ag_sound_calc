import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import Items, { getItemsWithApiImages } from "../data/items";
import { getImageUrl, getConstructionByCode, getConstructionProps } from "../services/api";
import { getResponsiveImageProps } from "../utils/responsiveImages";
import articles from "../data/articles";
import Modal from "./Modal";
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
  const [item, setItem] = useState(null);
  const [constructionData, setConstructionData] = useState(null);
  const [materials, setMaterials] = useState(null);
  const [loading, setLoading] = useState(true);
  const [materialsExpanded, setMaterialsExpanded] = useState(false);
  const [historyModal, setHistoryModal] = useState({
    isOpen: false,
    title: "",
    html: "",
  });
  const [zipsItems, setZipsItems] = useState(null); // Оба варианта ЗИПС (потолок и облицовка)
  const [currentImageIndex, setCurrentImageIndex] = useState(0); // Индекс текущего изображения в слайдере
  const [currentCadIndex, setCurrentCadIndex] = useState(0); // Индекс текущего чертежа в слайдере
  const initialIndexSet = useRef(false); // Флаг для отслеживания, были ли установлены начальные индексы

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
        
        // Определяем секцию из state навигации, sessionStorage или выбираем элемент
        const navigationCId = location.state?.c_id || sessionStorage.getItem('itemInfo_c_id');
        console.log('[ItemInfo] Получение state навигации:', {
          id,
          locationState: location.state,
          sessionStorageCId: sessionStorage.getItem('itemInfo_c_id'),
          navigationCId,
          sameAgItems: sameAgItems.map(i => ({ id: i.id, c_id: i.c_id, title: i.title })),
        });
        
        // Если есть navigationCId, используем его для выбора элемента
        // Иначе выбираем по умолчанию (сначала облицовку, потом потолок)
        let foundItem;
        if (navigationCId) {
          foundItem = sameAgItems.find((item) => item.c_id === navigationCId) || sameAgItems[0] || null;
          // Сохраняем navigationCId для использования в установке индексов
          sessionStorage.setItem('itemInfo_selected_c_id', navigationCId);
        } else {
          foundItem = sameAgItems.find((item) => item.c_id === "L") ||
            sameAgItems.find((item) => item.c_id === "C") ||
            sameAgItems[0] ||
            null;
        }
        
        console.log('[ItemInfo] Выбранный элемент:', {
          foundItem: foundItem ? { id: foundItem.id, c_id: foundItem.c_id, title: foundItem.title } : null,
        });
        
        // Очищаем sessionStorage после использования
        if (navigationCId) {
          sessionStorage.removeItem('itemInfo_c_id');
        }
        
        if (foundItem) {
          setItem(foundItem);
          
          // Для ЗИПС (id 201-205) получаем оба варианта (потолок и облицовка)
          const isZIPS = [201, 202, 203, 204, 205].includes(foundItem.id);
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
            
            // Сохраняем данные для текущего элемента
            const currentConstruction = foundItem.c_id === "C" ? ceilingConstruction : liningConstruction;
            setConstructionData(currentConstruction);
            
            // Сохраняем c_id для установки индексов после формирования массивов
            // Индексы будут установлены в useEffect после формирования imageSources и cadImageSources
          } else {
            setZipsItems(null);
            // Загружаем полные данные конструкции из API
            const construction = await getConstructionByCode(id);
            setConstructionData(construction);
          }
          
          // Загружаем материалы конструкции, используя Code из construction или ag_id из item
          const codeToUse = construction?.Code || id;
          if (codeToUse) {
            const props = await getConstructionProps(codeToUse);
            
            if (props?.constr_materials) {
              // Ищем объект с type: "Materials" и извлекаем из него constr_materials
              const materialsItem = props.constr_materials.find(item => item.type === "Materials");
              
              if (materialsItem && materialsItem.constr_materials) {
                setMaterials(materialsItem.constr_materials);
              } else {
                setMaterials(null);
              }
            } else {
              setMaterials(null);
            }
          }
        }
      } catch (error) {
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

  // Устанавливаем начальные индексы слайдера после загрузки данных
  useEffect(() => {
    if (zipsItems && item && !initialIndexSet.current && [201, 202, 203, 204, 205].includes(item.id)) {
      // Проверяем, что данные загружены
      const hasCeilingImage = zipsItems.ceiling && (zipsItems.ceiling.Img || zipsItems.ceiling.img || zipsItems.ceilingConstruction?.Img);
      const hasLiningImage = zipsItems.lining && (zipsItems.lining.Img || zipsItems.lining.img || zipsItems.liningConstruction?.Img);
      const hasCeilingCad = zipsItems.ceiling && zipsItems.ceiling.id && zipsCeilingCadImages[zipsItems.ceiling.id];
      const hasLiningCad = zipsItems.lining && (zipsItems.liningConstruction?.CadImg);
      
      // Получаем c_id из sessionStorage, если он был сохранен
      const selectedCId = sessionStorage.getItem('itemInfo_selected_c_id') || item.c_id;
      
      console.log('[ItemInfo] Установка индексов:', {
        itemCId: item.c_id,
        selectedCId,
        hasCeilingImage,
        hasLiningImage,
        hasCeilingCad,
        hasLiningCad,
      });
      
      if ((hasCeilingImage || hasLiningImage) && (hasCeilingCad || hasLiningCad)) {
        // Если перешли из секции потолок (c_id === "C"), показываем потолок первым (индекс 0)
        // Если перешли из секции облицовка (c_id === "L"), показываем облицовку первой
        if (selectedCId === "C") {
          // Потолок идет первым в массиве, индекс 0
          console.log('[ItemInfo] Устанавливаем индексы для потолка: 0, 0');
          setCurrentImageIndex(0);
          setCurrentCadIndex(0);
        } else if (selectedCId === "L") {
          // Облицовка идет второй в массиве (индекс 1), если потолок есть
          const imageIndex = hasCeilingImage ? 1 : 0;
          const cadIndex = hasCeilingCad ? 1 : 0;
          console.log('[ItemInfo] Устанавливаем индексы для облицовки:', { imageIndex, cadIndex });
          setCurrentImageIndex(imageIndex);
          setCurrentCadIndex(cadIndex);
        }
        initialIndexSet.current = true;
        // Очищаем sessionStorage после использования
        sessionStorage.removeItem('itemInfo_selected_c_id');
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
                  <div className="item-info-materials">
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
                          
                          return (
                            <li key={index} className="item-info-material-item">
                              {displayText}
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
              <p>
                {data.Specification}
                <button 
                  className="our-history-button"
                  onClick={() => {
                    if (!articles || articles.length === 0) return;
                    const randomArticle = articles[Math.floor(Math.random() * articles.length)];
                    // Преобразуем переносы строк в <br> для корректного отображения
                    const htmlContent = (randomArticle?.content || "")
                      .split("\n")
                      .map(line => line.trim())
                      .filter(Boolean)
                      .join("<br>");
                    setHistoryModal({
                      isOpen: true,
                      title: randomArticle?.name || "Наша история",
                      html: htmlContent,
                    });
                  }}
                  aria-label="Наша история"
                >
                  <img 
                    src={`${import.meta.env.BASE_URL || '/'}our-history.png`} 
                    alt="Наша история" 
                    className="our-history-svg"
                  />
                </button>
              </p>
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
      <Modal
        isOpen={historyModal.isOpen}
        onClose={() => setHistoryModal({ isOpen: false, title: "", html: "" })}
        title={historyModal.title}
        html={historyModal.html}
        imageUrl={`${import.meta.env.BASE_URL || '/'}our-history.png`}
        imageWidth="120px"
        imageHeight="120px"
        confirmButtonText="Закрыть"
        confirmButtonColor="#6cabc8"
      />
    </div>
  );
};

export default ItemInfo;

