import isEmpty from 'lodash/isEmpty';
import isFunction from 'lodash/isFunction';
import flatten from 'lodash/flatten';
import type { TdFormProps, FormValidateResult, FormResetParams, FormValidateMessage, AllValidateResult } from '../type';
import useConfig from '../../_util/useConfig';

export default function useInstance(props: TdFormProps, formRef, formItemsRef) {
  const { classPrefix } = useConfig();
  const FORM_ITEM_CLASS_PREFIX = `${classPrefix}-form-item__`;

  const { scrollToFirstError, preventSubmitDefault = true, onSubmit } = props;

  // calc all formItems
  function getFormItemsMap() {
    const formItemsMap = formItemsRef.current.reduce((acc, { current: currItem }) => {
      if (currItem?.name) {
        const { name } = currItem;
        return { ...acc, [name]: currItem };
      }
      return acc;
    }, {});

    return formItemsMap;
  }

  // 获取第一个错误表单
  function getFirstError(r: FormValidateResult<FormData>) {
    if (r === true) return;
    const [firstKey] = Object.keys(r);
    if (scrollToFirstError) {
      scrollTo(`.${FORM_ITEM_CLASS_PREFIX + firstKey}`);
    }
    return r[firstKey][0]?.message;
  }

  // 校验不通过时，滚动到第一个错误表单
  function scrollTo(selector: string) {
    const dom = formRef.current.querySelector(selector);
    const behavior = scrollToFirstError as ScrollBehavior;
    dom && dom.scrollIntoView({ behavior });
  }

  // 对外方法 手动提交表单
  function submit(e?: React.FormEvent<HTMLFormElement>) {
    if (preventSubmitDefault) {
      e?.preventDefault?.();
      e?.stopPropagation?.();
    }
    validate().then((r) => {
      const firstError = getFirstError(r);
      onSubmit?.({ validateResult: r, firstError, e });
    });
  }

  // 对外方法，该方法会触发全部表单组件错误信息显示
  function validate(param?: Record<string, any>): Promise<FormValidateResult<FormData>> {
    function needValidate(name: string, fields: string[]) {
      if (!fields || !Array.isArray(fields)) return true;
      return fields.indexOf(name) !== -1;
    }

    const { fields, trigger = 'all' } = param || {};
    const list = formItemsRef.current
      .filter(
        ({ current: formItemRef }) =>
          formItemRef && isFunction(formItemRef.validate) && needValidate(formItemRef.name, fields),
      )
      .map(({ current: formItemRef }) => formItemRef.validate(trigger));

    return new Promise((resolve) => {
      Promise.all(flatten(list))
        .then((arr: any) => {
          const r = arr.reduce((r, err) => Object.assign(r || {}, err), {});
          Object.keys(r).forEach((key) => {
            if (r[key] === true) {
              delete r[key];
            } else {
              r[key] = r[key].filter((fr: AllValidateResult) => fr.result === false);
            }
          });
          resolve(isEmpty(r) ? true : r);
        })
        .catch(console.error);
    });
  }

  // 对外方法，获取对应 formItem 的值
  function getFieldValue(name: string) {
    if (!name) return null;
    const target = formItemsRef.current.find(({ current: formItemRef }) => formItemRef?.name === name);
    return target.current?.value;
  }

  // 对外方法，获取一组字段名对应的值，当调用 getFieldsValue(true) 时返回所有值
  function getFieldsValue(nameList: string[] | boolean) {
    const fieldsValue = {};
    const formItemsMap = getFormItemsMap();

    if (nameList === true) {
      formItemsRef.current.forEach(({ current: formItemRef }) => {
        // 过滤无 name 的数据
        if (formItemRef?.name) {
          fieldsValue[formItemRef.name] = formItemRef.value;
        }
      });
    } else {
      if (!Array.isArray(nameList)) throw new Error('getFieldsValue 参数需要 Array 类型');
      nameList.forEach((name) => {
        if (formItemsMap[name]) fieldsValue[name] = formItemsMap[name].value;
      });
    }
    return fieldsValue;
  }

  // 对外方法，设置对应 formItem 的值
  function setFieldsValue(fields = {}) {
    const formItemsMap = getFormItemsMap();
    Object.keys(fields).forEach((key) => {
      formItemsMap[key]?.setValue(fields[key]);
    });
  }

  // 对外方法，设置对应 formItem 的数据
  function setFields(fields = []) {
    if (!Array.isArray(fields)) throw new Error('setFields 参数需要 Array 类型');
    const formItemsMap = getFormItemsMap();
    fields.forEach((field) => {
      const { name, value, status } = field;
      formItemsMap[name]?.setField({ value, status });
    });
  }

  // 对外方法，重置对应 formItem 的数据
  function reset(params: FormResetParams) {
    // reset all
    if (typeof params === 'undefined') {
      formItemsRef.current.forEach(({ current: formItemRef }) => {
        formItemRef && formItemRef?.resetField();
      });
    } else {
      const { type = 'initial', fields = [] } = params;
      const formItemsMap = getFormItemsMap();
      fields.forEach((name) => {
        formItemsMap[name]?.resetField(type);
      });
    }
  }

  // 对外方法，重置对应 formItem 的状态
  function clearValidate(fields?: Array<keyof FormData>) {
    // reset all
    if (typeof fields === 'undefined') {
      formItemsRef.current.forEach(({ current: formItemRef }) => {
        formItemRef && formItemRef?.resetValidate();
      });
    } else {
      if (!Array.isArray(fields)) throw new Error('clearValidate 参数需要 Array 类型');
      const formItemsMap = getFormItemsMap();
      fields.forEach((name) => {
        formItemsMap[name]?.resetValidate();
      });
    }
  }

  // 对外方法，设置 formItem 的错误信息
  function setValidateMessage(message: FormValidateMessage<FormData>) {
    const formItemsMap = getFormItemsMap();
    Object.keys(message).forEach((name) => {
      formItemsMap[name].setValidateMessage(message[name]);
    });
  }

  return {
    submit,
    reset,
    validate,
    clearValidate,
    setFields,
    setFieldsValue,
    setValidateMessage,
    getFieldValue,
    getFieldsValue,
  };
}
