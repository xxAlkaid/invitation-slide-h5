/**
 * 垂直滑动翻页H5页面 - VerticalSlider 类
 * 功能：触摸滑动、鼠标滚轮、键盘导航、滑动阻力效果、指示箭头动画
 */

// 图片配置：当前共有 11 张图片（images/1.jpg 到 images/11.jpg）
const TOTAL_IMAGES = 11;
const IMAGE_PATH_TEMPLATE = 'images/{index}.jpg';

class VerticalSlider {
  constructor(options = {}) {
    this.currentIndex = 0;
    this.totalSlides = options.totalSlides || TOTAL_IMAGES;
    this.imagePath = options.imagePath || IMAGE_PATH_TEMPLATE;
    this.isTransitioning = false;
    this.touchStartY = 0;
    this.touchEndY = 0;
    this.minSwipeDistance = 50;

    this.container = document.getElementById('container');
    this.slideWrapper = document.getElementById('slideWrapper');
    this.loading = document.getElementById('loading');
    this.scrollArrow = document.getElementById('scrollArrow');
    this.arrowTimer = null;
    this.arrowAnimationCount = 0;
    this.maxAnimationCount = 3;

    // 图片缩放相关
    this.imageScale = null;
    this.imageWidth = null;
    this.imageHeight = null;
    this.scaleCalculated = false;

    this.init();
  }

  /**
   * 初始化
   */
  init () {
    this.createSlides();
    this.bindEvents();
    this.updateSlidePosition();
    this.hideLoading();
  }

  /**
   * 动态创建幻灯片
   */
  createSlides () {
    for (let i = 0; i < this.totalSlides; i++) {
      const slide = document.createElement('div');
      slide.className = 'slide';
      slide.style.transform = `translateY(${i * 100}%)`;

      const img = document.createElement('img');
      img.src = this.imagePath.replace('{index}', i + 1);
      img.alt = `图片 ${i + 1}`;
      img.loading = 'lazy';

      // 图片加载错误处理
      img.onerror = () => {
        console.error(`图片 ${img.src} 加载失败`);
      };

      // 图片加载完成后，检查是否需要计算缩放比例
      img.addEventListener('load', () => {
        this.handleImageLoad(img);
      });

      // 如果图片已经加载完成（缓存情况）
      if (img.complete) {
        setTimeout(() => {
          this.handleImageLoad(img);
        }, 0);
      }

      slide.appendChild(img);
      this.slideWrapper.appendChild(slide);
    }
  }

  /**
   * 绑定事件监听器
   */
  bindEvents () {
    // 触摸事件
    this.container.addEventListener('touchstart', (e) => {
      this.touchStartY = e.touches[0].clientY;
    }, { passive: true });

    this.container.addEventListener('touchmove', (e) => {
      if (!this.isTransitioning) {
        const currentY = e.touches[0].clientY;
        const diff = this.touchStartY - currentY;

        // 添加滑动阻力效果
        if (this.currentIndex === 0 && diff < 0) {
          // 在第一张时向下滑动，添加阻力
          this.slideWrapper.style.transform = `translateY(${-this.currentIndex * 100}% + ${diff * 0.3}px)`;
        } else if (this.currentIndex === this.totalSlides - 1 && diff > 0) {
          // 在最后一张时向上滑动，添加阻力
          this.slideWrapper.style.transform = `translateY(${-this.currentIndex * 100}% + ${diff * 0.3}px)`;
        } else {
          this.slideWrapper.style.transition = 'none';
          this.slideWrapper.style.transform = `translateY(${-this.currentIndex * 100}% + ${-diff}px)`;
        }
      }
    }, { passive: true });

    this.container.addEventListener('touchend', (e) => {
      this.touchEndY = e.changedTouches[0].clientY;
      this.handleSwipe();
    }, { passive: true });

    // 鼠标滚轮事件（桌面端）
    this.container.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (this.isTransitioning) return;

      if (e.deltaY > 0 && this.currentIndex < this.totalSlides - 1) {
        this.nextSlide();
      } else if (e.deltaY < 0 && this.currentIndex > 0) {
        this.prevSlide();
      }
    }, { passive: false });

    // 键盘事件
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        this.nextSlide();
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        this.prevSlide();
      }
    });

    // 防止页面滚动
    document.addEventListener('touchmove', (e) => {
      if (e.target.closest('.container')) {
        e.preventDefault();
      }
    }, { passive: false });

    // 窗口尺寸变化时，重新计算缩放比例并应用到所有图片
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        this.scaleCalculated = false;
        this.calculateAndApplyScale();
      }, 200); // 防抖，200ms后执行
    });
  }

  /**
   * 处理图片加载
   * 如果是第一张加载完成的图片，计算缩放比例
   * 然后应用缩放比例到所有图片
   */
  handleImageLoad (img) {
    // 如果还没有计算过缩放比例，且这张图片已加载完成
    if (!this.scaleCalculated && img.complete && img.naturalWidth && img.naturalHeight) {
      // 保存图片尺寸（假设所有图片尺寸相同）
      this.imageWidth = img.naturalWidth;
      this.imageHeight = img.naturalHeight;
      // 计算缩放比例
      this.calculateScale();
      this.scaleCalculated = true;
    }
    // 应用缩放比例到当前图片
    this.applyScale(img);
  }

  /**
   * 计算缩放比例（只计算一次）
   */
  calculateScale () {
    if (!this.imageWidth || !this.imageHeight) {
      return;
    }

    // 主体内容区域的安全边距
    const safeMarginTop = 50;
    const safeMarginBottom = 50;
    const safeMarginLeft = 20;
    const safeMarginRight = 20;

    // 主体内容区域尺寸
    const contentWidth = this.imageWidth - safeMarginLeft - safeMarginRight;
    const contentHeight = this.imageHeight - safeMarginTop - safeMarginBottom;

    // 屏幕尺寸
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    // 如果内容区域尺寸无效，不设置缩放
    if (contentWidth <= 0 || contentHeight <= 0) {
      this.imageScale = null;
      return;
    }

    // 计算缩放比例：使得主体内容区域填满屏幕
    const scaleX = screenWidth / contentWidth;
    const scaleY = screenHeight / contentHeight;

    // 取较小值，确保主体内容区域完全显示且不被裁剪
    this.imageScale = Math.min(scaleX, scaleY);
  }

  /**
   * 应用缩放比例到图片
   */
  applyScale (img) {
    if (!this.imageScale || !this.imageWidth || !this.imageHeight) {
      // 如果没有计算过缩放比例，使用默认contain
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.transform = 'none';
      return;
    }

    // 计算缩放后的图片尺寸
    const scaledImgWidth = this.imageWidth * this.imageScale;
    const scaledImgHeight = this.imageHeight * this.imageScale;

    // 应用缩放
    img.style.width = `${scaledImgWidth}px`;
    img.style.height = `${scaledImgHeight}px`;
    img.style.transform = 'none';
  }

  /**
   * 计算缩放比例并应用到所有图片
   */
  calculateAndApplyScale () {
    const images = this.slideWrapper.querySelectorAll('img');
    
    // 找到第一张已加载完成的图片来计算缩放比例
    let firstLoadedImg = null;
    for (const img of images) {
      if (img.complete && img.naturalWidth && img.naturalHeight) {
        firstLoadedImg = img;
        break;
      }
    }

    if (firstLoadedImg) {
      this.imageWidth = firstLoadedImg.naturalWidth;
      this.imageHeight = firstLoadedImg.naturalHeight;
      this.calculateScale();
      this.scaleCalculated = true;
    }

    // 应用缩放比例到所有图片
    images.forEach(img => {
      this.applyScale(img);
    });
  }

  /**
   * 处理滑动手势
   */
  handleSwipe () {
    if (this.isTransitioning) return;

    const swipeDistance = this.touchStartY - this.touchEndY;
    this.slideWrapper.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';

    if (Math.abs(swipeDistance) > this.minSwipeDistance) {
      if (swipeDistance > 0 && this.currentIndex < this.totalSlides - 1) {
        // 向上滑动，下一张
        this.nextSlide();
      } else if (swipeDistance < 0 && this.currentIndex > 0) {
        // 向下滑动，上一张
        this.prevSlide();
      } else {
        // 滑动距离不够或到达边界，恢复位置
        this.updateSlidePosition();
      }
    } else {
      // 滑动距离不够，恢复位置
      this.updateSlidePosition();
    }
  }

  /**
   * 下一张
   */
  nextSlide () {
    if (this.currentIndex < this.totalSlides - 1 && !this.isTransitioning) {
      this.currentIndex++;
      this.updateSlidePosition();
    }
  }

  /**
   * 上一张
   */
  prevSlide () {
    if (this.currentIndex > 0 && !this.isTransitioning) {
      this.currentIndex--;
      this.updateSlidePosition();
    }
  }

  /**
   * 跳转到指定幻灯片
   */
  goToSlide (index) {
    if (index >= 0 && index < this.totalSlides && !this.isTransitioning) {
      this.currentIndex = index;
      this.updateSlidePosition();
    }
  }

  /**
   * 更新幻灯片位置
   */
  updateSlidePosition () {
    this.isTransitioning = true;
    this.slideWrapper.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    this.slideWrapper.style.transform = `translateY(${-this.currentIndex * 100}%)`;

    // 更新箭头显示和闪烁
    this.updateArrow();

    // 过渡结束后重置状态
    setTimeout(() => {
      this.isTransitioning = false;
    }, 400);
  }

  /**
   * 更新指示箭头
   */
  updateArrow () {
    // 清除之前的定时器
    if (this.arrowTimer) {
      clearTimeout(this.arrowTimer);
      this.arrowTimer = null;
    }

    // 移除动画类
    this.scrollArrow.classList.remove('animating');

    // 清理之前的动画结束监听器
    const img = this.scrollArrow.querySelector('img');
    if (img && img._animationEndHandler) {
      img.removeEventListener('animationend', img._animationEndHandler);
      img._animationEndHandler = null;
    }

    // 如果是最后一张图片，隐藏箭头
    if (this.currentIndex >= this.totalSlides - 1) {
      this.scrollArrow.classList.remove('visible');
      this.arrowAnimationCount = 0;
      return;
    }

    // 重置动画计数器（切换到新页面时）
    this.arrowAnimationCount = 0;

    // 显示箭头容器
    this.scrollArrow.classList.add('visible');

    // 确保初始opacity为0
    if (img) {
      img.style.opacity = '0';
    }

    // 开始执行动画（每页执行3次）
    this.startArrowBlink();
  }

  /**
   * 开始箭头动画
   * 淡入淡出 + 呼吸效果：opacity从0到1再到0（3秒）
   * 每页连续执行3次后，空白5秒，然后重播
   */
  startArrowBlink () {
    // 检查是否还在当前页面（用户可能已经切换了）
    if (this.currentIndex >= this.totalSlides - 1) {
      return;
    }

    // 检查是否已达到最大执行次数
    if (this.arrowAnimationCount >= this.maxAnimationCount) {
      // 停止动画，保持opacity为0
      this.scrollArrow.classList.remove('animating');
      const img = this.scrollArrow.querySelector('img');
      if (img) {
        img.style.opacity = '0';
      }

      // 空白5秒后，重置计数器并重新开始
      this.arrowTimer = setTimeout(() => {
        this.arrowAnimationCount = 0;
        this.startArrowBlink();
      }, 5000); // 空白5秒

      return;
    }

    // 增加执行次数
    this.arrowAnimationCount++;

    // 移除之前的动画结束监听器（如果存在）
    const img = this.scrollArrow.querySelector('img');
    if (img && img._animationEndHandler) {
      img.removeEventListener('animationend', img._animationEndHandler);
    }

    // 移除动画类，然后重新添加以确保动画重新开始
    this.scrollArrow.classList.remove('animating');

    // 使用 requestAnimationFrame 确保动画类已完全移除后再添加
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.scrollArrow.classList.add('animating');

        // 监听动画结束事件
        if (img) {
          img._animationEndHandler = () => {
            // 确保opacity为0
            img.style.opacity = '0';

            // 检查是否还需要继续执行动画
            if (this.arrowAnimationCount < this.maxAnimationCount &&
              this.currentIndex < this.totalSlides - 1) {
              // 立即继续执行下一次动画（无间隔）
              this.startArrowBlink();
            } else {
              // 如果已达到3次，调用 startArrowBlink 来触发空白5秒后的重播
              // startArrowBlink 会检测到 arrowAnimationCount >= maxAnimationCount
              // 然后设置5秒定时器并重置计数器
              this.startArrowBlink();
            }
          };
          img.addEventListener('animationend', img._animationEndHandler);
        }
      });
    });
  }


  /**
   * 隐藏加载动画
   */
  hideLoading () {
    // 等待所有图片加载完成后隐藏加载动画
    const images = this.slideWrapper.querySelectorAll('img');
    let loadedCount = 0;

    const checkAllLoaded = () => {
      loadedCount++;
      if (loadedCount === images.length) {
        setTimeout(() => {
          this.loading.classList.add('hidden');
        }, 300);
      }
    };

    images.forEach(img => {
      if (img.complete) {
        checkAllLoaded();
      } else {
        img.addEventListener('load', checkAllLoaded);
        img.addEventListener('error', checkAllLoaded); // 即使加载失败也计数
      }
    });

    // 如果3秒后还没加载完，强制隐藏
    setTimeout(() => {
      this.loading.classList.add('hidden');
    }, 3000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('container');
  const totalSlides = container?.dataset?.totalSlides
    ? parseInt(container.dataset.totalSlides, 10)
    : TOTAL_IMAGES;

  new VerticalSlider({
    totalSlides: totalSlides
  });
});
