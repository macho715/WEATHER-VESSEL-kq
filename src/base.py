"""로지스틱 기반 모델 정의입니다. / Base definitions for logistics models."""

from __future__ import annotations

from typing import Any, ClassVar

from pydantic import BaseModel, ConfigDict


class LogiBaseModel(BaseModel):
    """로지스틱 공통 베이스 모델입니다. / Common logistics base model."""

    model_config: ClassVar[ConfigDict] = ConfigDict(
        frozen=True,
        populate_by_name=True,
        use_enum_values=True,
        validate_assignment=True,
        ser_json_timedelta="iso8601",
    )

    def model_dump_jsonable(self, **kwargs: Any) -> dict[str, Any]:
        """JSON 직렬화 가능한 덤프입니다. / Dump JSON-serializable dict."""

        data = self.model_dump(mode="json", **kwargs)
        return data
