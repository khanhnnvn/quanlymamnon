package tenant

import (
	"context"
	"regexp"
	"strconv"
	"strings"
)

var slugFormat = regexp.MustCompile(`^mamnon_[a-z0-9_]+$`)

var diacriticsReplacer = strings.NewReplacer(
	"à", "a", "á", "a", "ạ", "a", "ả", "a", "ã", "a", "â", "a", "ầ", "a", "ấ", "a", "ậ", "a", "ẩ", "a", "ẫ", "a",
	"ă", "a", "ằ", "a", "ắ", "a", "ặ", "a", "ẳ", "a", "ẵ", "a",
	"è", "e", "é", "e", "ẹ", "e", "ẻ", "e", "ẽ", "e", "ê", "e", "ề", "e", "ế", "e", "ệ", "e", "ể", "e", "ễ", "e",
	"ì", "i", "í", "i", "ị", "i", "ỉ", "i", "ĩ", "i",
	"ò", "o", "ó", "o", "ọ", "o", "ỏ", "o", "õ", "o", "ô", "o", "ồ", "o", "ố", "o", "ộ", "o", "ổ", "o", "ỗ", "o",
	"ơ", "o", "ờ", "o", "ớ", "o", "ợ", "o", "ở", "o", "ỡ", "o",
	"ù", "u", "ú", "u", "ụ", "u", "ủ", "u", "ũ", "u", "ư", "u", "ừ", "u", "ứ", "u", "ự", "u", "ử", "u", "ữ", "u",
	"ỳ", "y", "ý", "y", "ỵ", "y", "ỷ", "y", "ỹ", "y",
	"đ", "d",
)

var nonSlugChars = regexp.MustCompile(`[^a-z0-9_]+`)
var multiUnderscore = regexp.MustCompile(`_+`)

// slugify converts a school name into a `mamnon_[a-z0-9_]+` base slug.
func slugify(name string) string {
	s := strings.ToLower(strings.TrimSpace(name))
	s = diacriticsReplacer.Replace(s)
	s = nonSlugChars.ReplaceAllString(s, "_")
	s = multiUnderscore.ReplaceAllString(s, "_")
	s = strings.Trim(s, "_")
	if s == "" {
		s = "truong"
	}
	if !strings.HasPrefix(s, "mamnon_") {
		s = "mamnon_" + s
	}
	return s
}

// resolveSlug returns a unique, correctly formatted slug: the client-supplied
// one if valid and free, otherwise one derived from the school name, with a
// numeric suffix appended on collision.
func (s *Service) resolveSlug(ctx context.Context, requested, name string) (string, error) {
	base := ""
	if requested != "" && slugFormat.MatchString(requested) {
		base = requested
	} else {
		base = slugify(name)
	}

	slug := base
	for i := 2; ; i++ {
		exists, err := s.repo.SlugExists(ctx, slug)
		if err != nil {
			return "", err
		}
		if !exists {
			return slug, nil
		}
		slug = base + "_" + strconv.Itoa(i)
	}
}
